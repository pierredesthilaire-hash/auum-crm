import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/dates";
import { ensureAutoTasks } from "./autoTasks";
import { DashboardView } from "./DashboardView";
import type { AeOption, MeetingRow, OppKpi, TaskRow } from "./types";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ ae?: string }>;
}) {
  const { ae: aeParam } = await searchParams;
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

  const { data: aes } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "ae")
    .order("full_name")
    .returns<AeOption[]>();

  const targetAeId = isDirection && aeParam ? aeParam : profile!.id;
  const targetAe = isDirection
    ? (aes ?? []).find((a) => a.id === targetAeId) ?? { id: profile!.id, full_name: profile!.full_name }
    : { id: profile!.id, full_name: profile!.full_name };

  const today = todayISO();

  await ensureAutoTasks(supabase, targetAe.id, today);

  const [{ data: openOpps }, { data: wonOpps }, { data: meetings }, { data: tasks }] = await Promise.all([
    supabase
      .from("opportunities")
      .select("id, amount, prob, machines, close_date")
      .eq("ae_id", targetAe.id)
      .eq("state", "open")
      .returns<OppKpi[]>(),
    supabase
      .from("opportunities")
      .select("id, machines")
      .eq("ae_id", targetAe.id)
      .eq("state", "won"),
    supabase
      .from("meetings")
      .select("id, date, start_time, end_time, title, with_who, place, opp_id")
      .eq("ae_id", targetAe.id)
      .eq("date", today)
      .order("start_time")
      .returns<MeetingRow[]>(),
    supabase
      .from("tasks")
      .select("id, title, type, due, note, auto, rule, opp_id, opportunities(name, entities(name))")
      .eq("owner_id", targetAe.id)
      .eq("status", "open")
      .returns<TaskRow[]>(),
  ]);

  return (
    <DashboardView
      targetAe={targetAe}
      aes={aes ?? []}
      isDirection={isDirection}
      openOpps={openOpps ?? []}
      wonMachines={(wonOpps ?? []).reduce((s, o) => s + o.machines, 0)}
      wonCount={(wonOpps ?? []).length}
      meetings={meetings ?? []}
      tasks={tasks ?? []}
      today={today}
    />
  );
}
