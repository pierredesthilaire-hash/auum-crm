import { createClient } from "@/lib/supabase/server";
import { PipeBoard } from "./PipeBoard";
import type { OppRow } from "./types";

export default async function PipePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user!.id)
    .single();

  const isDirection = profile?.role === "direction";

  const [{ data: opps }, { data: aes }, { data: entities }] = await Promise.all([
    supabase
      .from("opportunities")
      .select(
        "id, name, stage, machines, amount, prob, close_date, install_date, notes, dyn_id, stage_orig, created_at, entity_id, ae_id, entities(name), profiles(full_name)",
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
      currentUser={{ id: profile!.id, fullName: profile!.full_name, isDirection }}
    />
  );
}
