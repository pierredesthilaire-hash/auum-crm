/**
 * Nettoyage de la base :
 *   1. vide le journal des modifications (audit_log) ;
 *   2. supprime tous les prospects (les touches et les tâches liées à un
 *      prospect partent avec, en cascade) ;
 *   3. supprime le compte « Alexandre Kader » (utilisateur + profil), après
 *      avoir détaché ou supprimé ce qui référence son profil.
 *
 * Les comptes clients, contacts et opportunités ne sont PAS touchés.
 * Une sauvegarde JSON est écrite dans backups/ avant toute suppression.
 *
 * Par défaut : SIMULATION (aucune écriture). Ajouter --apply pour exécuter.
 *
 * Usage :
 *   npx tsx scripts/cleanup-db.ts            (simulation)
 *   npx tsx scripts/cleanup-db.ts --apply
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

loadEnv({ path: resolve(__dirname, "../.env.local") });

const APPLY = process.argv.includes("--apply");
const TARGET_NAME_PATTERN = "Alexandre K%"; // Kader / Khader

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) throw new Error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis (.env.local)");
const supabase = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

async function count(table: string, eq?: [string, string]): Promise<number> {
  const base = supabase.from(table).select("id", { count: "exact", head: true });
  const { count: n, error } = eq ? await base.eq(eq[0], eq[1]) : await base;
  if (error) throw new Error(`${table} : ${error.message}`);
  return n ?? 0;
}

async function dump(table: string): Promise<unknown[]> {
  const all: unknown[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select("*").range(from, from + 999);
    if (error) throw new Error(`${table} : ${error.message}`);
    all.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return all;
}

async function check(label: string, p: PromiseLike<{ error: { message: string } | null }>) {
  const { error } = await p;
  if (error) throw new Error(`${label} : ${error.message}`);
  console.log(`ok : ${label}`);
}

async function main() {
  // --- Compte cible ---
  const { data: targets, error: tErr } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .ilike("full_name", TARGET_NAME_PATTERN);
  if (tErr) throw tErr;
  if ((targets ?? []).length > 1) {
    console.error("Plusieurs profils correspondent, arrêt :", targets);
    process.exit(1);
  }
  const target = targets?.[0] ?? null;

  const nAudit = await count("audit_log");
  const nProspects = await count("prospects");
  const nTouches = await count("touches");
  console.log(`Journal : ${nAudit} lignes à supprimer`);
  console.log(`Prospects : ${nProspects} à supprimer (${nTouches} touches liées)`);

  if (target) {
    const nOpps = await count("opportunities", ["ae_id", target.id]);
    const nTasks = await count("tasks", ["owner_id", target.id]);
    console.log(`Compte à supprimer : ${target.full_name} (rôle ${target.role}) — ${nOpps} opportunités, ${nTasks} tâches`);
    if (nOpps > 0) {
      console.error(`Arrêt : ${target.full_name} porte encore ${nOpps} opportunités. Réattribuez-les d'abord.`);
      process.exit(1);
    }
  } else {
    console.log("Aucun profil « Alexandre K… » trouvé : rien à supprimer de ce côté.");
  }

  if (!APPLY) {
    console.log("\nSIMULATION terminée — rien n'a été écrit. Relancer avec --apply pour exécuter.");
    return;
  }

  // --- Sauvegarde ---
  const dir = resolve(__dirname, "../backups", `${new Date().toISOString().replace(/[:.]/g, "-")}-nettoyage`);
  mkdirSync(dir, { recursive: true });
  const backups: Array<[string, unknown[]]> = [
    ["audit_log", await dump("audit_log")],
    ["prospects", await dump("prospects")],
    ["touches", await dump("touches")],
    ["tasks", await dump("tasks")],
  ];
  if (target) backups.push(["profile", [target]]);
  for (const [name, rows] of backups) {
    writeFileSync(resolve(dir, `${name}.json`), JSON.stringify(rows, null, 2));
    console.log(`sauvegarde ${name} : ${rows.length} lignes -> ${dir}`);
  }

  // --- 1. Journal ---
  await check("journal vidé", supabase.from("audit_log").delete().not("id", "is", null));

  // --- 2. Prospects (touches et tâches de prospect en cascade) ---
  await check("prospects supprimés", supabase.from("prospects").delete().not("id", "is", null));

  // --- 3. Compte cible ---
  if (target) {
    const id = target.id;
    await check("tâches du compte supprimées", supabase.from("tasks").delete().eq("owner_id", id));
    await check("tâches créées par le compte détachées", supabase.from("tasks").update({ created_by: null }).eq("created_by", id));
    await check("demandes BDD du compte supprimées", supabase.from("bdd_requests").delete().eq("ae_id", id));
    await check("demandes BDD décidées par le compte détachées", supabase.from("bdd_requests").update({ decided_by: null }).eq("decided_by", id));
    await check("campagnes détachées", supabase.from("campaigns").update({ ae_id: null }).eq("ae_id", id));
    await check("RDV détachés", supabase.from("meetings").update({ ae_id: null }).eq("ae_id", id));
    await check("comptes clients détachés", supabase.from("entities").update({ owner_id: null }).eq("owner_id", id));

    const { error: delErr } = await supabase.auth.admin.deleteUser(id);
    if (delErr) throw new Error(`suppression de l'utilisateur : ${delErr.message}`);
    console.log("ok : utilisateur supprimé");
    // Le profil part normalement en cascade ; on nettoie au cas où.
    await check("profil supprimé", supabase.from("profiles").delete().eq("id", id));
  }

  console.log(
    `\nTerminé. Journal : ${await count("audit_log")} ligne(s) · prospects : ${await count("prospects")} · ` +
      `profils restants : ${await count("profiles")}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
