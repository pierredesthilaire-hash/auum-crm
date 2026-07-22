import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/currentUser";
import { todayISO } from "@/lib/dates";
import { ensureAutoTasks } from "./autoTasks";
import { DashboardView } from "./DashboardView";
import type { AeOption, MeetingRow, OppKpi, TaskRow } from "./types";

type AeRow = AeOption & { autotasks_ran_on: string | null };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ ae?: string }>;
}) {
  const { ae: aeParam } = await searchParams;
  const supabase = await createClient();

  const [user, { data: aes }] = await Promise.all([
    getCurrentUser(),
    supabase
      .from("profiles")
      .select("id, full_name, autotasks_ran_on")
      .eq("role", "ae")
      .order("full_name")
      .returns<AeRow[]>(),
  ]);

  const isDirection = user!.isDirection;
  const targetAeId = isDirection && aeParam ? aeParam : user!.id;
  const targetAe: AeRow =
    (aes ?? []).find((a) => a.id === targetAeId) ?? {
      id: user!.id,
      full_name: user!.fullName,
      autotasks_ran_on: null,
    };

  const today = todayISO();

  await ensureAutoTasks(supabase, targetAe.id, targetAe.autotasks_ran_on, today);

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
