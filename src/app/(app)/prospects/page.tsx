import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/currentUser";
import { ProspectsView } from "./ProspectsView";
import type { AeOption, ProspectRow } from "./types";

export default async function ProspectsPage() {
  const supabase = await createClient();

  const [user, { data: prospects }, { data: aes }] = await Promise.all([
    getCurrentUser(),
    supabase
      .from("prospects")
      .select(
        "id, company, contact, role, email, phone, linkedin, city, sector, headcount, ae_id, status, source, opp_id, created_at, next_action_date, profiles(full_name), touches(id)",
      )
      .order("created_at", { ascending: false })
      .range(0, 9999)
      .returns<ProspectRow[]>(),
    supabase.from("profiles").select("id, full_name").eq("role", "ae").order("full_name").returns<AeOption[]>(),
  ]);

  return (
    <ProspectsView
      prospects={prospects ?? []}
      aes={aes ?? []}
      currentUser={{ id: user!.id, fullName: user!.fullName, isDirection: user!.isDirection }}
    />
  );
}
