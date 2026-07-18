import { createClient } from "@/lib/supabase/server";
import { ProspectsView } from "./ProspectsView";
import type { AeOption, ProspectRow } from "./types";

export default async function ProspectsPage() {
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

  const [{ data: prospects }, { data: aes }] = await Promise.all([
    supabase
      .from("prospects")
      .select(
        "id, company, contact, role, email, phone, linkedin, city, sector, headcount, ae_id, status, source, opp_id, created_at, profiles(full_name), touches(id)",
      )
      .order("created_at", { ascending: false })
      .returns<ProspectRow[]>(),
    supabase.from("profiles").select("id, full_name").eq("role", "ae").order("full_name").returns<AeOption[]>(),
  ]);

  return (
    <ProspectsView
      prospects={prospects ?? []}
      aes={aes ?? []}
      currentUser={{ id: profile!.id, fullName: profile!.full_name, isDirection }}
    />
  );
}
