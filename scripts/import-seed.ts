/**
 * Import data/seed.json dans Supabase.
 * Ordre : profils (AE) → groups → entities → contacts → opportunities → tasks → audit → settings.
 * Par défaut, exclut tout enregistrement `demo: true`. Utiliser --with-demo pour les inclure.
 *
 * Usage : npx tsx scripts/import-seed.ts [--with-demo]
 */
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

loadEnv({ path: resolve(__dirname, "../.env.local") });

const WITH_DEMO = process.argv.includes("--with-demo");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis (.env.local)",
  );
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type Seed = {
  opps: Array<{
    id: string;
    dynId: string | null;
    name: string;
    client: string;
    ae: string;
    machines: number;
    prob: number;
    stage: string;
    phaseOrig: string | null;
    source: string | null;
    closeDate: string | null;
    installDate: string | null;
    createdOn: string | null;
    amount: number;
    notes: string | null;
  }>;
  entities: Array<{
    id: string;
    name: string;
    groupId: string | null;
    parc: number;
    parcNote: string | null;
    contacts: Array<{
      fullName?: string;
      full_name?: string;
      role?: string;
      email?: string;
      phone?: string;
      linkedin?: string;
    }>;
    siret: string | null;
    sector: string | null;
    headcount: number | null;
    owner: string | null;
  }>;
  groups: Array<{ id: string; name: string; auto: boolean }>;
  tasks: Array<{
    id: string;
    title: string;
    type: string | null;
    due: string | null;
    owner: string;
    createdBy: string | null;
    oppId: string | null;
    prospectId: string | null;
    note: string | null;
    auto: boolean;
    rule?: string | null;
    status: string;
    createdOn: string | null;
    demo?: boolean;
  }>;
  audit: Array<{
    ts: string;
    user: string;
    oppId: string | null;
    type: string;
    detail: string | null;
    dir?: string | null;
    deltaMachines?: number | null;
    deltaAmount?: number | null;
    demo?: boolean;
  }>;
  segConfig: { smb: number; grand: number };
  segOwners: Record<string, string[]>;
};

const seed: Seed = JSON.parse(
  readFileSync(resolve(__dirname, "../data/seed.json"), "utf8"),
);

// Référentiel lead lifecycle 2024-2025 — repris du prototype (pas dans seed.json).
const BENCHMARKS = {
  global: { cycle: 70.4, close: 40 },
  sources: {
    Outbound: { cycle: 70.4, close: 29 },
    Marketing: { cycle: 74.5, close: 23 },
    Upsell: { cycle: 63.3, close: 61 },
    Renouvellement: { cycle: 68.2, close: 68 },
  },
  alertRatio: 1.5,
  floor: 0.5,
};

const AE_USERS: Array<{ fullName: string; email: string; role: "direction" | "ae" }> = [
  { fullName: "Pierre de Saint Hilaire", email: "pierre.desainthilaire@auum.fr", role: "direction" },
  { fullName: "Léo Consigny", email: "leo.consigny@auum.fr", role: "ae" },
  { fullName: "Mathieu Espiard", email: "mathieu.espiard@auum.fr", role: "ae" },
  { fullName: "Wandrille Ernault", email: "wandrille@auum.fr", role: "ae" },
  { fullName: "Steve Custos", email: "steve.custos@auum.fr", role: "ae" },
];

function tempPassword(): string {
  return randomBytes(9).toString("base64url");
}

async function upsertUsers(): Promise<Map<string, string>> {
  const nameToId = new Map<string, string>();
  const credentials: Array<{ email: string; password: string }> = [];

  for (const u of AE_USERS) {
    const password = tempPassword();
    const { data: created, error: createErr } =
      await supabase.auth.admin.createUser({
        email: u.email,
        password,
        email_confirm: true,
        user_metadata: { full_name: u.fullName },
      });

    let userId: string;
    if (createErr) {
      if (!/already been registered|already exists/i.test(createErr.message)) {
        throw createErr;
      }
      const { data: list, error: listErr } = await supabase.auth.admin.listUsers();
      if (listErr) throw listErr;
      const existing = list.users.find((x) => x.email === u.email);
      if (!existing) throw new Error(`Utilisateur introuvable après conflit : ${u.email}`);
      userId = existing.id;
      console.log(`= ${u.email} existe déjà, réutilisé`);
    } else {
      userId = created.user.id;
      credentials.push({ email: u.email, password });
      console.log(`+ ${u.email} créé`);
    }

    const { error: profileErr } = await supabase
      .from("profiles")
      .upsert({ id: userId, full_name: u.fullName, role: u.role });
    if (profileErr) throw profileErr;

    nameToId.set(u.fullName, userId);
  }

  if (credentials.length) {
    console.log("\nMots de passe temporaires (à transmettre toi-même, à faire changer au 1er login) :");
    for (const c of credentials) console.log(`  ${c.email} / ${c.password}`);
    console.log();
  }

  return nameToId;
}

async function importGroups(): Promise<Map<string, string>> {
  const idMap = new Map<string, string>();
  for (const g of seed.groups) {
    const { data, error } = await supabase
      .from("groups")
      .upsert({ name: g.name, auto: g.auto }, { onConflict: "name" })
      .select("id")
      .single();
    if (error) throw error;
    idMap.set(g.id, data.id);
  }
  console.log(`groups: ${idMap.size} importés`);
  return idMap;
}

async function importEntities(
  groupIdMap: Map<string, string>,
  nameToUserId: Map<string, string>,
): Promise<Map<string, string>> {
  const nameToEntityId = new Map<string, string>();
  for (const e of seed.entities) {
    const { data, error } = await supabase
      .from("entities")
      .upsert(
        {
          name: e.name,
          group_id: e.groupId ? groupIdMap.get(e.groupId) ?? null : null,
          siret: e.siret || null,
          sector: e.sector || null,
          headcount: e.headcount,
          parc: e.parc ?? 0,
          parc_note: e.parcNote || null,
          owner_id: e.owner ? nameToUserId.get(e.owner) ?? null : null,
        },
        { onConflict: "name" },
      )
      .select("id")
      .single();
    if (error) throw error;
    nameToEntityId.set(e.name, data.id);
  }
  console.log(`entities: ${nameToEntityId.size} importées`);
  return nameToEntityId;
}

async function importContacts(nameToEntityId: Map<string, string>): Promise<void> {
  let count = 0;
  for (const e of seed.entities) {
    for (const c of e.contacts ?? []) {
      const entityId = nameToEntityId.get(e.name);
      if (!entityId) continue;
      const { error } = await supabase.from("contacts").insert({
        entity_id: entityId,
        full_name: c.fullName ?? c.full_name ?? "Sans nom",
        role: c.role ?? null,
        email: c.email ?? null,
        phone: c.phone ?? null,
        linkedin: c.linkedin ?? null,
      });
      if (error) throw error;
      count++;
    }
  }
  console.log(`contacts: ${count} importés`);
}

async function importOpportunities(
  nameToEntityId: Map<string, string>,
  nameToUserId: Map<string, string>,
): Promise<Map<string, string>> {
  const seedIdToOppId = new Map<string, string>();
  for (const o of seed.opps) {
    const entityId = nameToEntityId.get(o.client);
    const aeId = nameToUserId.get(o.ae);
    if (!entityId) throw new Error(`Compte introuvable pour l'oppo ${o.id} : ${o.client}`);
    if (!aeId) throw new Error(`AE introuvable pour l'oppo ${o.id} : ${o.ae}`);

    const { data, error } = await supabase
      .from("opportunities")
      .insert({
        dyn_id: o.dynId,
        name: o.name,
        entity_id: entityId,
        ae_id: aeId,
        stage: o.stage,
        stage_orig: o.phaseOrig,
        machines: o.machines,
        amount: o.amount,
        prob: o.prob,
        source: o.source,
        close_date: o.closeDate,
        install_date: o.installDate,
        notes: o.notes || null,
        created_at: o.createdOn ?? undefined,
      })
      .select("id")
      .single();
    if (error) throw error;
    seedIdToOppId.set(o.id, data.id);
  }
  console.log(`opportunities: ${seedIdToOppId.size} importées`);
  return seedIdToOppId;
}

async function importTasks(
  nameToUserId: Map<string, string>,
  seedIdToOppId: Map<string, string>,
): Promise<void> {
  const rows = seed.tasks.filter((t) => WITH_DEMO || !t.demo);
  for (const t of rows) {
    const ownerId = nameToUserId.get(t.owner);
    if (!ownerId) throw new Error(`Owner introuvable pour la tâche ${t.id} : ${t.owner}`);
    const { error } = await supabase.from("tasks").insert({
      title: t.title,
      type: t.type ?? "Autre",
      due: t.due,
      owner_id: ownerId,
      created_by: t.createdBy ? nameToUserId.get(t.createdBy) ?? null : null,
      opp_id: t.oppId ? seedIdToOppId.get(t.oppId) ?? null : null,
      note: t.note,
      auto: t.auto ?? false,
      rule: t.rule ?? null,
      status: t.status,
      created_at: t.createdOn ?? undefined,
    });
    if (error) throw error;
  }
  console.log(`tasks: ${rows.length} importées (${WITH_DEMO ? "avec" : "sans"} démo)`);
}

async function importAudit(
  nameToUserId: Map<string, string>,
  seedIdToOppId: Map<string, string>,
): Promise<void> {
  const rows = seed.audit.filter((a) => WITH_DEMO || !a.demo);
  for (const a of rows) {
    const userId = nameToUserId.get(a.user);
    const { error } = await supabase.from("audit_log").insert({
      at: a.ts,
      user_id: userId ?? null,
      opp_id: a.oppId ? seedIdToOppId.get(a.oppId) ?? null : null,
      type: a.type,
      detail: a.detail,
      dir: a.dir ?? null,
      delta_machines: a.deltaMachines ?? null,
      delta_amount: a.deltaAmount ?? null,
    });
    if (error) throw error;
  }
  console.log(`audit_log: ${rows.length} importées (${WITH_DEMO ? "avec" : "sans"} démo)`);
}

async function importSettings(nameToUserId: Map<string, string>): Promise<void> {
  void nameToUserId;
  const rows = [
    { key: "seg_config", value: seed.segConfig },
    { key: "seg_owners", value: seed.segOwners },
    { key: "benchmarks", value: BENCHMARKS },
  ];
  const { error } = await supabase.from("settings").upsert(rows);
  if (error) throw error;
  console.log(`settings: ${rows.length} clés importées`);
}

async function main() {
  const { count } = await supabase
    .from("opportunities")
    .select("id", { count: "exact", head: true });
  if (count && count > 0 && !process.argv.includes("--force")) {
    console.error(
      `La table opportunities contient déjà ${count} lignes. ` +
        `Relancer l'import créerait des doublons (pas de contrainte d'unicité métier). ` +
        `Vide la table ou relance avec --force pour ignorer cette vérification.`,
    );
    process.exit(1);
  }

  console.log(`Import ${WITH_DEMO ? "AVEC" : "SANS"} les enregistrements demo:true\n`);

  const nameToUserId = await upsertUsers();
  const groupIdMap = await importGroups();
  const nameToEntityId = await importEntities(groupIdMap, nameToUserId);
  await importContacts(nameToEntityId);
  const seedIdToOppId = await importOpportunities(nameToEntityId, nameToUserId);
  await importTasks(nameToUserId, seedIdToOppId);
  await importAudit(nameToUserId, seedIdToOppId);
  await importSettings(nameToUserId);

  console.log("\nImport terminé.");
}

main().catch((err) => {
  console.error("Échec de l'import :", err);
  process.exit(1);
});
