/**
 * Remet à zéro la liste des tâches de tous les utilisateurs (AE + direction)
 * et réarme les tâches automatiques (profiles.autotasks_ran_on = null).
 * Sauvegarde JSON dans backups/ avant suppression.
 *
 * Par défaut : SIMULATION. Ajouter --apply pour exécuter.
 *   npx.cmd tsx scripts/reset-tasks.ts
 *   npx.cmd tsx scripts/reset-tasks.ts --apply
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

loadEnv({ path: resolve(__dirname, "../.env.local") });
const APPLY = process.argv.includes("--apply");
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) throw new Error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis (.env.local)");
const supabase = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  const { data: tasks, error } = await supabase.from("tasks").select("*");
  if (error) throw new Error(error.message);
  const { data: profiles } = await supabase.from("profiles").select("id, full_name");
  const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const perOwner = new Map<string, number>();
  for (const t of tasks ?? []) {
    const n = names.get(t.owner_id) ?? "?";
    perOwner.set(n, (perOwner.get(n) ?? 0) + 1);
  }
  console.log(`${tasks?.length ?? 0} tâche(s) à supprimer :`);
  for (const [n, c] of perOwner) console.log(`  ${n} : ${c}`);
  if (!APPLY) {
    console.log("\nSIMULATION terminée — rien n'a été écrit. Relancer avec --apply pour exécuter.");
    return;
  }
  const dir = resolve(__dirname, "../backups", `${new Date().toISOString().replace(/[:.]/g, "-")}-taches`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, "tasks.json"), JSON.stringify(tasks, null, 2));
  console.log(`sauvegarde -> ${dir}`);
  const d = await supabase.from("tasks").delete().not("id", "is", null);
  if (d.error) throw new Error(d.error.message);
  const u = await supabase.from("profiles").update({ autotasks_ran_on: null }).not("id", "is", null);
  if (u.error) throw new Error(u.error.message);
  console.log("Terminé : tâches supprimées, tâches automatiques réarmées.");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
