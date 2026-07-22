import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_BENCHMARKS, isAging, type Benchmarks } from "@/lib/lifecycle";
import { addDaysISO } from "@/lib/dates";

type OppForRules = {
  id: string;
  name: string;
  stage: string;
  source: string | null;
  close_date: string | null;
  created_at: string;
  entities: { name: string } | null;
};

/**
 * Génère les tâches automatiques (aging/late/nodate) pour les oppos ouvertes
 * d'un AE — appelé à chaque chargement du Dashboard mais ne fait un vrai
 * travail qu'une fois par jour par AE (voir `ranOn`). Idempotent grâce à la
 * contrainte unique (rule, opp_id) : upsert silencieux si la tâche existe déjà.
 */
export async function ensureAutoTasks(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  aeId: string,
  ranOn: string | null,
  today: string,
): Promise<void> {
  // Déjà exécuté aujourd'hui pour cet AE : on évite de refaire 2 lectures
  // + 1 écriture à chaque chargement du Dashboard dans la même journée.
  if (ranOn === today) return;

  const [{ data: settingRow }, { data: opps }] = await Promise.all([
    supabase.from("settings").select("value").eq("key", "benchmarks").single(),
    supabase
      .from("opportunities")
      .select("id, name, stage, source, close_date, created_at, entities(name)")
      .eq("ae_id", aeId)
      .eq("state", "open")
      .returns<OppForRules[]>(),
  ]);
  const benchmarks = (settingRow?.value as Benchmarks) ?? DEFAULT_BENCHMARKS;

  const rows: {
    title: string;
    type: string;
    due: string;
    owner_id: string;
    opp_id: string;
    auto: true;
    rule: string;
    note: string;
    status: "open";
  }[] = [];

  for (const o of opps ?? []) {
    const client = o.entities?.name ?? o.name;

    if (isAging(o, benchmarks, today)) {
      rows.push({
        title: `⏳ Relancer ou statuer — ${client}`,
        type: "Relance",
        due: addDaysISO(today, 3),
        owner_id: aeId,
        opp_id: o.id,
        auto: true,
        rule: "aging",
        note: "Oppo vieillissante par rapport au cycle de vente de référence — relancer le client ou fermer l'oppo.",
        status: "open",
      });
    }
    if (o.close_date && o.close_date < today) {
      rows.push({
        title: `⏰ Requalifier le closing — ${client}`,
        type: "Relance",
        due: today,
        owner_id: aeId,
        opp_id: o.id,
        auto: true,
        rule: "late",
        note: `Date de fermeture estimée dépassée (${o.close_date}) — mettre à jour la date ou statuer.`,
        status: "open",
      });
    }
    if (["nego", "signature"].includes(o.stage) && !o.close_date) {
      rows.push({
        title: `📅 Fixer une date de closing — ${client}`,
        type: "Administratif",
        due: addDaysISO(today, 2),
        owner_id: aeId,
        opp_id: o.id,
        auto: true,
        rule: "nodate",
        note: "Oppo en négociation/signature sans date de closing — le forecast ne la voit pas.",
        status: "open",
      });
    }
  }

  if (rows.length) {
    // upsert : ne recrée pas une tâche déjà générée pour ce (rule, opp_id),
    // et ne touche pas au statut si elle a déjà été traitée par l'AE.
    await supabase.from("tasks").upsert(rows, { onConflict: "rule,opp_id", ignoreDuplicates: true });
  }

  await supabase.rpc("mark_autotasks_ran", { target_ae_id: aeId, run_date: today });
}
