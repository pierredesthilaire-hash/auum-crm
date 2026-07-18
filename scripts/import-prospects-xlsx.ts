/**
 * Import ponctuel d'un export de prospection Excel (multi-onglets, un
 * onglet par AE, bloc de stats en haut de chaque onglet suivi du tableau
 * de prospects à partir de la ligne "Segment | Société | ...").
 *
 * Usage : npx tsx scripts/import-prospects-xlsx.ts <chemin.xlsx>
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

loadEnv({ path: resolve(__dirname, "../.env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis (.env.local)");
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage : npx tsx scripts/import-prospects-xlsx.ts <chemin.xlsx>");
  process.exit(1);
}

// Onglet du fichier -> AE cible dans le CRM. "Lucile" n'a pas de compte :
// ses prospects sont rattachés à Alexandre, à sa demande.
const SHEET_TO_AE: Record<string, string> = {
  "Léo": "Léo Consigny",
  "Léo Industrie": "Léo Consigny",
  Steve: "Steve Custos",
  Wandrille: "Wandrille Ernault",
  Mathieu: "Mathieu Espiard",
  Lucile: "Alexandre Kader",
  Alexandre: "Alexandre Kader",
};

const NEW_AE = { fullName: "Alexandre Kader", email: "alexandre.kader@auum.fr" };

function fmtDate(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v ?? "").trim();
  // certaines cellules sont du texte "JJ/MM/AAAA" plutôt que des dates Excel
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

function parseHeadcount(raw: unknown): number | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  const m = s.match(/^(\d+)\s*-\s*(\d+)$/);
  if (m) return Math.round((parseInt(m[1], 10) + parseInt(m[2], 10)) / 2);
  return null;
}

async function ensureAlexandre(): Promise<string> {
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email: NEW_AE.email,
    password: Buffer.from(crypto.randomUUID()).toString("base64url").slice(0, 14),
    email_confirm: true,
    user_metadata: { full_name: NEW_AE.fullName },
  });

  let userId: string;
  if (createErr) {
    if (!/already been registered|already exists/i.test(createErr.message)) throw createErr;
    const { data: list, error: listErr } = await supabase.auth.admin.listUsers();
    if (listErr) throw listErr;
    const existing = list.users.find((u) => u.email === NEW_AE.email);
    if (!existing) throw new Error(`Utilisateur introuvable après conflit : ${NEW_AE.email}`);
    userId = existing.id;
    console.log(`= ${NEW_AE.email} existe déjà, réutilisé`);
  } else {
    userId = created.user.id;
    console.log(`+ ${NEW_AE.email} créé (mot de passe temporaire à réinitialiser)`);
  }

  const { error: profileErr } = await supabase
    .from("profiles")
    .upsert({ id: userId, full_name: NEW_AE.fullName, role: "ae" });
  if (profileErr) throw profileErr;

  return userId;
}

async function main() {
  const aeMap = new Map<string, string>();
  aeMap.set(NEW_AE.fullName, await ensureAlexandre());

  const { data: aes, error: aesErr } = await supabase.from("profiles").select("id, full_name").eq("role", "ae");
  if (aesErr) throw aesErr;
  for (const a of aes ?? []) aeMap.set(a.full_name, a.id);

  const wb = XLSX.readFile(filePath, { cellDates: true });

  let totalInserted = 0;
  let totalTouches = 0;

  for (const [sheetName, aeName] of Object.entries(SHEET_TO_AE)) {
    const ws = wb.Sheets[sheetName];
    if (!ws) {
      console.warn(`! onglet "${sheetName}" introuvable, ignoré`);
      continue;
    }
    const aeId = aeMap.get(aeName);
    if (!aeId) {
      console.warn(`! AE "${aeName}" introuvable dans profiles, onglet "${sheetName}" ignoré`);
      continue;
    }

    const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { defval: "", header: 1 });
    const header = (rows[9] ?? []).map((h) => String(h).trim());
    const data = rows.slice(10).filter((r) => r.some((c) => c !== ""));

    const idx = (name: string) => header.indexOf(name);
    const iSegment = idx("Segment");
    const iSociete = idx("Société");
    const iSecteur = idx("Secteur d'activité");
    const iPrenom = idx("Prénom");
    const iNom = idx("Nom");
    const iTel = idx("Téléphone");
    const iEmail = idx("Email");
    const iTitre = idx("Titre");
    const iTaille = header.findIndex((h) => h.toLowerCase().includes("taille"));
    const iLinkedin = idx("Lien Linkedin");
    const iAppele = idx("Appelé ?");
    const iDateAppel = idx("Date d'appel");
    const iRappel = idx("A rappeler ?");
    const iDateRappel = idx("Date de rappel");
    const iRefus = idx("Motif Refus");
    const iComment = idx("Commentaires");
    const iR1 = idx("R1 Obtenu ?");
    const iDateR1 = idx("Date R1");

    const rowsToInsert: {
      company: string;
      contact: string | null;
      role: string | null;
      email: string | null;
      phone: string | null;
      linkedin: string | null;
      sector: string | null;
      headcount: number | null;
      ae_id: string;
      status: string;
      notes: string | null;
      source: string;
      _appele: string;
      _dateAppel: string;
    }[] = [];

    for (const r of data) {
      const company = String(r[iSociete] ?? "").trim();
      if (!company) continue;

      const prenom = iPrenom >= 0 ? String(r[iPrenom] ?? "").trim() : "";
      const nom = iNom >= 0 ? String(r[iNom] ?? "").trim() : "";
      const contact = [prenom, nom].filter(Boolean).join(" ") || null;

      const segment = iSegment >= 0 ? String(r[iSegment] ?? "").trim() : "";
      const appele = iAppele >= 0 ? String(r[iAppele] ?? "").trim() : "";
      const dateAppel = iDateAppel >= 0 ? fmtDate(r[iDateAppel]) : "";
      const rappel = iRappel >= 0 ? String(r[iRappel] ?? "").trim() : "";
      const dateRappel = iDateRappel >= 0 ? fmtDate(r[iDateRappel]) : "";
      const refus = iRefus >= 0 ? String(r[iRefus] ?? "").trim() : "";
      const comment = iComment >= 0 ? String(r[iComment] ?? "").trim() : "";
      const r1 = iR1 >= 0 ? String(r[iR1] ?? "").trim() : "";
      const dateR1 = iDateR1 >= 0 ? fmtDate(r[iDateR1]) : "";

      let status = "a_contacter";
      if (refus) status = "sans_suite";
      else if (r1) status = "r1_realise";
      else if (appele) status = "contacte";

      const notesParts: string[] = [];
      if (segment) notesParts.push(`Segment (ancien fichier) : ${segment}`);
      if (appele) notesParts.push(`Appel : ${appele}${dateAppel ? ` le ${dateAppel}` : ""}`);
      if (rappel.toLowerCase() === "oui") notesParts.push(`À rappeler${dateRappel ? ` le ${dateRappel}` : ""}`);
      if (refus) notesParts.push(`Motif refus : ${refus}`);
      if (comment) notesParts.push(`Commentaire : ${comment}`);
      if (r1) notesParts.push(`R1 obtenu${dateR1 ? ` le ${dateR1}` : ""}`);

      rowsToInsert.push({
        company,
        contact,
        role: (iTitre >= 0 ? String(r[iTitre] ?? "").trim() : "") || null,
        email: (iEmail >= 0 ? String(r[iEmail] ?? "").trim() : "") || null,
        phone: (iTel >= 0 ? String(r[iTel] ?? "").trim() : "") || null,
        linkedin: (iLinkedin >= 0 ? String(r[iLinkedin] ?? "").trim() : "") || null,
        sector: (iSecteur >= 0 ? String(r[iSecteur] ?? "").trim() : "") || null,
        headcount: iTaille >= 0 ? parseHeadcount(r[iTaille]) : null,
        ae_id: aeId,
        status,
        notes: notesParts.join(" · ") || null,
        source: `Import PROSPECTION.xlsx — ${sheetName}`,
        _appele: appele,
        _dateAppel: dateAppel,
      });
    }

    // Insertion par lots de 500 pour rester sous les limites de payload,
    // en récupérant les ids pour poser les touches associées.
    for (let i = 0; i < rowsToInsert.length; i += 500) {
      const batch = rowsToInsert.slice(i, i + 500);
      const { data: inserted, error } = await supabase
        .from("prospects")
        .insert(batch.map(({ _appele, _dateAppel, ...row }) => row))
        .select("id");
      if (error) throw new Error(`Échec insertion (${sheetName}, lot ${i}) : ${error.message}`);

      const touchRows = (inserted ?? [])
        .map((row, j) => ({ prospect_id: row.id, appele: batch[j]._appele, dateAppel: batch[j]._dateAppel }))
        .filter((t) => t.appele)
        .map((t) => ({
          prospect_id: t.prospect_id,
          type: "tel" as const,
          at: t.dateAppel ? `${t.dateAppel}T09:00:00Z` : undefined,
          source: "import",
        }));
      if (touchRows.length) {
        const { error: touchErr } = await supabase.from("touches").insert(touchRows);
        if (touchErr) throw new Error(`Échec insertion touches (${sheetName}) : ${touchErr.message}`);
        totalTouches += touchRows.length;
      }

      totalInserted += batch.length;
    }

    console.log(`${sheetName} -> ${aeName} : ${rowsToInsert.length} prospects`);
  }

  console.log(`\nTerminé : ${totalInserted} prospects importés, ${totalTouches} touches historiques créées.`);
}

main().catch((err) => {
  console.error("Échec de l'import :", err);
  process.exit(1);
});
