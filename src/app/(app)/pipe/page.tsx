import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/currentUser";
import { PipeBoard } from "./PipeBoard";
import type { OppRow } from "./types";

export default async function PipePage() {
  const supabase = await createClient();

  const [user, { data: opps }, { data: aes }, { data: entities }] = await Promise.all([
    getCurrentUser(),
    supabase
      .from("opportunities")
      .select(
        "id, name, stage, machines, amount, prob, close_date, install_date, notes, meddic_metrics, meddic_economic_buyer, meddic_decision_criteria, meddic_decision_process, meddic_pain, meddic_champion, dyn_id, stage_orig, created_at, entity_id, ae_id, entities(name), profiles(full_name)",
      )
      .eq("state", "open")
      .order("amount", { ascending: false })
      .returns<OppRow[]>(),
    supabase.from("profiles").select("id, full_name").eq("role", "ae").order("full_name"),
    supabase.from("entities").select("name").order("name"),
  ]);

  return (
    <PipeBoard
      initialOpps={opps ?? []}
      aes={aes ?? []}
      entityNames={(entities ?? []).map((e) => e.name)}
      currentUser={{ id: user!.id, fullName: user!.fullName, isDirection: user!.isDirection }}
    />
  );
}
