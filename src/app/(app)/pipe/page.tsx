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
        "id, name, stage, machines, amount, prob, close_date, install_date, notes, meddic_metrics, meddic_economic_buyer, meddic_decision_criteria, meddic_decision_process, meddic_pain, meddic_champion, dyn_id, stage_orig, created_at, entity_id, ae_id, entities(name), profiles(full_name), opportunity_contacts(contacts(id, full_name, role, persona, email, phone, company)), quotes(id, number, created_at, duration_months, vat_rate, valid_until, status, notes, lines)",
      )
      .eq("state", "open")
      .order("amount", { ascending: false })
      .returns<OppRow[]>(),
    supabase.from("profiles").select("id, full_name").eq("role", "ae").order("full_name"),
    supabase.from("entities").select("name").order("name"),
  ]);

  // Onglets du Pipe : les AE, plus toute personne de la direction qui porte
  // elle-même des opportunités (ex. Pierre), pour qu'elles soient visibles.
  const aeList = aes ?? [];
  const knownIds = new Set(aeList.map((a) => a.id));
  const extraOwners = new Map<string, string>();
  for (const o of opps ?? []) {
    if (!knownIds.has(o.ae_id) && o.profiles?.full_name) {
      extraOwners.set(o.ae_id, o.profiles.full_name);
    }
  }
  const pipeOwners = [
    ...aeList,
    ...[...extraOwners].map(([id, full_name]) => ({ id, full_name })),
  ].sort((a, b) => a.full_name.localeCompare(b.full_name, "fr"));

  return (
    <PipeBoard
      initialOpps={opps ?? []}
      aes={pipeOwners}
      entityNames={(entities ?? []).map((e) => e.name)}
      currentUser={{ id: user!.id, fullName: user!.fullName, isDirection: user!.isDirection }}
    />
  );
}
