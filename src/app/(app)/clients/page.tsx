import { createClient } from "@/lib/supabase/server";
import { ClientsGrid } from "./ClientsGrid";
import type { AeOption, ContactRow, EntityOpp, EntityRow, GroupOption, NewsRow } from "./types";
import type { SegConfig } from "@/lib/segments";

export default async function ClientsPage() {
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

  const [
    { data: entities },
    { data: opps },
    { data: groups },
    { data: aes },
    { data: segSetting },
    { data: news },
    { data: contacts },
  ] = await Promise.all([
    supabase
      .from("entities")
      .select(
        "id, name, group_id, siret, sector, headcount, parc, parc_note, owner_id, groups(id, name), profiles(full_name)",
      )
      .order("name")
      .returns<EntityRow[]>(),
    supabase
      .from("opportunities")
      .select("id, entity_id, name, stage, machines, amount, close_date, ae_id, profiles(full_name)")
      .eq("state", "open")
      .returns<EntityOpp[]>(),
    supabase.from("groups").select("id, name").order("name").returns<GroupOption[]>(),
    supabase.from("profiles").select("id, full_name").eq("role", "ae").order("full_name").returns<AeOption[]>(),
    supabase.from("settings").select("value").eq("key", "seg_config").single(),
    supabase.from("news").select("entity_id, date, title, signal, suggestion").returns<NewsRow[]>(),
    supabase.from("contacts").select("id, entity_id, full_name, role, email, phone").returns<ContactRow[]>(),
  ]);

  const segConfig = (segSetting?.value as SegConfig) ?? { smb: 500, grand: 1000 };

  return (
    <ClientsGrid
      entities={entities ?? []}
      opps={opps ?? []}
      groups={groups ?? []}
      aes={aes ?? []}
      news={news ?? []}
      contacts={contacts ?? []}
      segConfig={segConfig}
      currentUser={{ id: profile!.id, fullName: profile!.full_name, isDirection }}
    />
  );
}
