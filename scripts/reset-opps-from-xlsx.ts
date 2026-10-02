/**
 * Remise à zéro des opportunités (et de leurs contacts) à partir d'un export
 * Dynamics (xlsx).
 *
 * Ce que fait le script :
 *   1. lit l'export « Pipe Global France » (opportunités ouvertes + colonnes
 *      du contact principal de chaque opportunité) ;
 *   2. sauvegarde les opportunités, tâches, journaux et RDV actuels du CRM
 *      dans backups/<horodatage>/*.json ;
 *   3. supprime les opportunités existantes (les tâches liées sont supprimées
 *      en cascade ; audit_log, meetings et prospects sont détachés) ;
 *   4. réimporte l'export, en créant les comptes (entities) manquants avec
 *      l'AE de l'opportunité comme propriétaire (sans quoi l'AE ne les voit pas) ;
 *   5. crée les contacts sur le compte client (sans doublon, y compris vis-à-vis
 *      des contacts déjà présents) et les lie à leur opportunité ; le persona
 *      est déduit de l'intitulé de poste quand il est reconnaissable.
 *
 * PRÉREQUIS : avoir exécuté db/migrations/2026-10-02-contacts-persona.sql
 * dans le SQL Editor de Supabase.
 *
 * Par défaut : SIMULATION (aucune écriture). Ajouter --apply pour exécuter.
 *
 * Usage :
 *   npx tsx scripts/reset-opps-from-xlsx.ts <export.xlsx> --parse-only
 *   npx tsx scripts/reset-opps-from-xlsx.ts <export.xlsx>            (simulation)
 *   npx tsx scripts/reset-opps-from-xlsx.ts <export.xlsx> --apply
 *   ... --create-ae "Nom=mail@auum.fr,Autre Nom=mail2@auum.fr"   (crée le compte AE)
 *   ... --skip-ae "Victor Thomas"   (n'importe pas les opportunités de cet AE)
 */
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

loadEnv({ path: resolve(__dirname, "../.env.local") });

const args = process.argv.slice(2);
const filePath = args.find((a) => !a.startsWith("--"));
const APPLY = args.includes("--apply");
const PARSE_ONLY = args.includes("--parse-only");
const createAeArg = args.find((a, i) => args[i - 1] === "--create-ae");
if (!filePath) {
  console.error("Usage : npx tsx scripts/reset-opps-from-xlsx.ts <export.xlsx> [--apply]");
  process.exit(1);
}

// Phase Dynamics -> étape du CRM (voir src/lib/stages.ts).
const PHASE_TO_STAGE: Record<string, string> = {
  R1: "decouverte",
  R2: "r2",
  "Démonstration": "demo",
  "Négociation": "nego",
  Validation: "signature",
};
const DEFAULT_STAGE = "decouverte"; // phase vide ou inconnue

// Persona déduit de l'intitulé de poste (src/lib/personas.ts). À défaut : vide.
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
function inferPersona(title: string | null): string | null {
  if (!title) return null;
  const t = norm(title);
  if (/\b(achat|achats|acheteur|acheteuse|procurement|purchasing|sourcing)\b/.test(t)) return "Achat";
  if (/\brse\b|responsabilite societ|dev(eloppement)? durable|\bdurable\b|\bcsr\b|\besg\b/.test(t)) return "RSE";
  if (/\b(qhse|hse|qse|she|securite|qualite|sante)\b|\bh&s\b|health and safety|environnement(?! de travail)/.test(t)) return "QHSE";
  if (/directeur (de )?site|directrice (de )?site|responsable de site|site manager|chef de site|direction de site/.test(t))
    return "Direction de Site";
  if (/services generaux|moyens generaux|general services|facility|facilities|workplace|environnement de travail|office manager/.test(t))
    return "Environnement de Travail";
  return null;
}

type Contact = {
  fullName: string;
  title: string | null;
  persona: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
};

type Row = {
  dynId: string;
  ae: string;
  name: string;
  client: string;
  machines: number;
  prob: number;
  closeDate: string | null;
  phase: string | null;
  stage: string;
  source: string | null;
  installDate: string | null;
  createdOn: string | null;
  amount: number;
  contact: Contact | null;
};

const iso = (v: unknown): string | null => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  if (Number.isNaN(d.getTime())) return null;
  // Dates Excel sans heure : on lit en heure locale pour éviter le décalage d'un jour.
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const text = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
};

function readExport(): Row[] {
  const wb = XLSX.readFile(filePath!, { cellDates: true });
  const ws = wb.Sheets["Pipe Global France"] ?? wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
  const rows: Row[] = [];
  for (const rawRow of raw) {
    // Les en-têtes de colonnes de contact commencent parfois par une espace.
    const r: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rawRow)) r[k.trim()] = v;

    const dynId = r["(Ne pas modifier) Opportunité"] as string | null;
    if (!dynId) continue;
    const phase = (r["Phase active"] as string | null) ?? null;

    const fullName = text(r["Nom complet (Contact) (Contact)"]);
    const title = text(r["Intitulé de poste (Contact) (Contact)"]);
    const contact: Contact | null = fullName
      ? {
          fullName,
          title,
          persona: inferPersona(title),
          email: text(r["Courrier électronique (Contact) (Contact)"]),
          phone: text(r["Téléphone professionel (Contact) (Contact)"]),
          company: text(r["Nom de la société (Contact) (Contact)"]),
        }
      : null;

    rows.push({
      dynId,
      ae: String(r["AE en charge"] ?? "").trim(),
      name: String(r["Nom de la transaction"] ?? "").trim(),
      client: String(r["Client potentiel"] ?? "").trim(),
      machines: Number(r["Nombre de machines"] ?? 1) || 1,
      prob: Number(r["Probabilité estimée par AE"] ?? 20) || 20,
      closeDate: iso(r["Date de fermeture estimée"]),
      phase,
      stage: (phase && PHASE_TO_STAGE[phase]) || DEFAULT_STAGE,
      source: (r["Provenance du lead"] as string | null) ?? null,
      installDate: iso(r["Date d'installation"]),
      createdOn: iso(r["Created On"]),
      amount: Number(r["Montant total"] ?? 0) || 0,
      contact,
    });
  }
  return rows;
}

function count<T>(xs: T[], key: (x: T) => string) {
  const m: Record<string, number> = {};
  for (const x of xs) m[key(x)] = (m[key(x)] ?? 0) + 1;
  return m;
}

// Clé de dédoublonnage d'un contact au sein d'un compte client.
const contactKey = (client: string, c: { fullName: string; email: string | null }) =>
  `${client.toLowerCase()}|${c.email ? "e:" + c.email.toLowerCase() : "n:" + norm(c.fullName)}`;

async function main() {
  const skipAes = args
    .map((a, i) => (args[i - 1] === "--skip-ae" ? a : null))
    .filter((a): a is string => !!a)
    .flatMap((a) => a.split(",").map((s) => s.trim()))
    .filter(Boolean);
  const allRows = readExport();
  const rows = allRows.filter((r) => !skipAes.includes(r.ae));
  if (skipAes.length) {
    console.log(`Ignorées (--skip-ae ${skipAes.join(", ")}) : ${allRows.length - rows.length} opportunités`);
  }
  console.log(`Export lu : ${rows.length} opportunités, ${rows.reduce((s, r) => s + r.machines, 0)} machines`);
  console.log("Par AE    :", count(rows, (r) => r.ae));
  console.log("Par étape :", count(rows, (r) => r.stage));
  const unknownPhases = rows.filter((r) => r.phase && !PHASE_TO_STAGE[r.phase]);
  if (unknownPhases.length) console.log("⚠ Phases non reconnues (-> R1) :", count(unknownPhases, (r) => r.phase!));
  console.log(`Sans phase : ${rows.filter((r) => !r.phase).length} | montant 0 : ${rows.filter((r) => !r.amount).length}`);

  // --- Contacts du fichier ---
  const withContact = rows.filter((r) => r.contact);
  const uniqueContacts = new Map<string, Contact & { client: string }>();
  for (const r of withContact) {
    const k = contactKey(r.client, r.contact!);
    if (!uniqueContacts.has(k)) uniqueContacts.set(k, { ...r.contact!, client: r.client });
  }
  console.log(`\nContacts : ${withContact.length} opportunités avec contact, ${uniqueContacts.size} contacts distincts`);
  console.log("Persona déduit :", count([...uniqueContacts.values()], (c) => c.persona ?? "(vide)"));
  const titled = [...uniqueContacts.values()].filter((c) => c.title);
  if (titled.length) {
    console.log("Intitulé de poste -> persona déduit (à vérifier) :");
    for (const c of titled) console.log(`  ${c.title}  ->  ${c.persona ?? "(vide)"}`);
  }
  if (PARSE_ONLY) return;

  const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL || !KEY) throw new Error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis (.env.local)");
  const supabase = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  // --- Migration appliquée ? ---
  const probe = await supabase.from("opportunity_contacts").select("opp_id").limit(1);
  const probe2 = await supabase.from("contacts").select("persona, company").limit(1);
  if (probe.error || probe2.error) {
    console.error(
      "\nArrêt : la base n'a pas encore les champs contacts (persona, société, liens avec les opportunités).\n" +
        "Exécutez d'abord db/migrations/2026-10-02-contacts-persona.sql dans le SQL Editor de Supabase.\n" +
        `(${probe.error?.message ?? probe2.error?.message})`,
    );
    process.exit(1);
  }

  // --- AE ---
  const { data: profiles, error: pErr } = await supabase.from("profiles").select("id, full_name");
  if (pErr) throw pErr;
  const aeId = new Map((profiles ?? []).map((p) => [p.full_name as string, p.id as string]));
  const wantedAes = [...new Set(rows.map((r) => r.ae))];
  const missingAes = wantedAes.filter((n) => !aeId.has(n));
  const toCreate = new Map<string, string>(
    (createAeArg ?? "").split(",").filter(Boolean).map((s) => s.split("=").map((x) => x.trim()) as [string, string]),
  );
  const stillMissing = missingAes.filter((n) => !toCreate.has(n));
  if (missingAes.length) console.log("AE sans compte CRM :", missingAes.join(", "));
  if (stillMissing.length) {
    console.error(`\nArrêt : indiquez --create-ae "Nom=email,..." (ou --skip-ae) pour : ${stillMissing.join(", ")}`);
    process.exit(1);
  }

  // --- Comptes (entities) : propriétaire = AE ayant le plus d'opportunités sur le compte ---
  const ownerOfClient = new Map<string, string>();
  for (const [client, byAe] of Object.entries(
    rows.reduce<Record<string, Record<string, number>>>((acc, r) => {
      (acc[r.client] ??= {})[r.ae] = (acc[r.client][r.ae] ?? 0) + 1;
      return acc;
    }, {}),
  )) {
    ownerOfClient.set(client, Object.entries(byAe).sort((a, b) => b[1] - a[1])[0][0]);
  }

  const { data: ents, error: eErr } = await supabase.from("entities").select("id, name, owner_id");
  if (eErr) throw eErr;
  const entityId = new Map((ents ?? []).map((e) => [e.name as string, e.id as string]));
  const entityOwner = new Map((ents ?? []).map((e) => [e.name as string, e.owner_id as string | null]));
  const clients = [...new Set(rows.map((r) => r.client))];
  const newClients = clients.filter((c) => !entityId.has(c));
  const ownerless = clients.filter((c) => entityId.has(c) && !entityOwner.get(c));
  console.log(`Comptes à créer : ${newClients.length}`, newClients.slice(0, 30));
  console.log(`Comptes existants sans propriétaire (rattachés à l'AE de leurs opportunités) : ${ownerless.length}`);

  // --- Contacts déjà présents (pour ne pas les dupliquer) ---
  const { data: existingContacts, error: cErr } = await supabase
    .from("contacts")
    .select("id, entity_id, full_name, email");
  if (cErr) throw cErr;
  const entityNameById = new Map((ents ?? []).map((e) => [e.id as string, e.name as string]));
  const existingContactId = new Map<string, string>();
  for (const c of existingContacts ?? []) {
    const client = entityNameById.get(c.entity_id as string);
    if (!client) continue;
    const base = { fullName: c.full_name as string, email: (c.email as string | null) ?? null };
    existingContactId.set(contactKey(client, base), c.id as string);
    existingContactId.set(contactKey(client, { ...base, email: null }), c.id as string);
  }
  const reused = [...uniqueContacts.keys()].filter((k) => existingContactId.has(k)).length;
  console.log(`Contacts à créer : ${uniqueContacts.size - reused} (déjà présents, simplement liés : ${reused})`);

  const { count: oppCount } = await supabase.from("opportunities").select("id", { count: "exact", head: true });
  const { count: taskCount } = await supabase.from("tasks").select("id", { count: "exact", head: true }).not("opp_id", "is", null);
  console.log(`\nSera supprimé : ${oppCount} opportunités et ${taskCount} tâches qui y sont liées.`);

  if (!APPLY) {
    console.log("\nSIMULATION terminée — rien n'a été écrit. Relancer avec --apply pour exécuter.");
    return;
  }

  // --- 1. Sauvegarde ---
  const dir = resolve(__dirname, "../backups", new Date().toISOString().replace(/[:.]/g, "-"));
  mkdirSync(dir, { recursive: true });
  for (const t of ["opportunities", "tasks", "audit_log", "meetings", "contacts"]) {
    const all: unknown[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from(t).select("*").range(from, from + 999);
      if (error) throw error;
      all.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    writeFileSync(resolve(dir, `${t}.json`), JSON.stringify(all, null, 2));
    console.log(`sauvegarde ${t} : ${all.length} lignes -> ${dir}`);
  }

  // --- 2. Comptes AE manquants ---
  for (const [name, email] of toCreate) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: randomBytes(9).toString("base64url"),
      email_confirm: true,
      user_metadata: { full_name: name },
    });
    if (error) throw error;
    const { error: pe } = await supabase.from("profiles").upsert({ id: data.user.id, full_name: name, role: "ae" });
    if (pe) throw pe;
    aeId.set(name, data.user.id);
    console.log(`+ AE créé : ${name} (${email}) — définir son mot de passe via « mot de passe oublié »`);
  }

  // --- 3. Comptes clients : création + propriétaire ---
  for (const name of newClients) {
    const { data, error } = await supabase
      .from("entities")
      .insert({ name, owner_id: aeId.get(ownerOfClient.get(name)!) })
      .select("id")
      .single();
    if (error) throw error;
    entityId.set(name, data.id);
  }
  for (const name of ownerless) {
    const { error } = await supabase
      .from("entities")
      .update({ owner_id: aeId.get(ownerOfClient.get(name)!) })
      .eq("id", entityId.get(name)!);
    if (error) throw error;
  }
  console.log(`comptes : ${newClients.length} créés, ${ownerless.length} rattachés à un propriétaire`);

  // --- 4. Suppression puis import des opportunités ---
  const { error: dErr } = await supabase.from("opportunities").delete().not("id", "is", null);
  if (dErr) throw dErr;
  console.log("opportunités supprimées");

  const oppIdByDyn = new Map<string, string>();
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100).map((r) => ({
      dyn_id: r.dynId,
      name: r.name,
      entity_id: entityId.get(r.client)!,
      ae_id: aeId.get(r.ae)!,
      stage: r.stage,
      stage_orig: r.phase,
      machines: r.machines,
      amount: r.amount,
      prob: r.prob,
      source: r.source,
      close_date: r.closeDate,
      install_date: r.installDate,
      created_at: r.createdOn ?? undefined,
    }));
    const { data, error } = await supabase.from("opportunities").insert(batch).select("id, dyn_id");
    if (error) throw error;
    for (const o of data ?? []) oppIdByDyn.set(o.dyn_id as string, o.id as string);
  }
  console.log(`opportunités importées : ${oppIdByDyn.size}`);

  // --- 5. Contacts et liens ---
  const contactIdByKey = new Map<string, string>(existingContactId);
  const toInsert = [...uniqueContacts.entries()].filter(([k]) => !contactIdByKey.has(k));
  for (let i = 0; i < toInsert.length; i += 100) {
    const batch = toInsert.slice(i, i + 100);
    const { data, error } = await supabase
      .from("contacts")
      .insert(
        batch.map(([, c]) => ({
          entity_id: entityId.get(c.client)!,
          full_name: c.fullName,
          role: c.title,
          persona: c.persona,
          email: c.email,
          phone: c.phone,
          company: c.company ?? c.client,
        })),
      )
      .select("id");
    if (error) throw error;
    (data ?? []).forEach((row, j) => contactIdByKey.set(batch[j][0], row.id as string));
  }
  const links = withContact
    .map((r) => ({
      opp_id: oppIdByDyn.get(r.dynId),
      contact_id: contactIdByKey.get(contactKey(r.client, r.contact!)),
    }))
    .filter((l): l is { opp_id: string; contact_id: string } => !!l.opp_id && !!l.contact_id);
  for (let i = 0; i < links.length; i += 100) {
    const { error } = await supabase
      .from("opportunity_contacts")
      .upsert(links.slice(i, i + 100), { onConflict: "opp_id,contact_id" });
    if (error) throw error;
  }
  console.log(`contacts créés : ${toInsert.length} · liens opportunité-contact : ${links.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
