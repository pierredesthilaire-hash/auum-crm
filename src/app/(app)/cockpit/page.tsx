import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/currentUser";
import { todayISO } from "@/lib/dates";
import { DEFAULT_BENCHMARKS, type Benchmarks } from "@/lib/lifecycle";
import { ensureAgingTasksForAll } from "../dashboard/autoTasks";
import { CockpitView } from "./CockpitView";
import type { WAudit, WTask, WMeeting, WQuote } from "@/lib/weekly";
import type { AeOption, AgingTask, AuditRow, CockpitOpp } from "./types";

export default async function CockpitPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();

  if (!user?.isDirection) {
    redirect("/dashboard");
  }

  const [{ data: opps }, { data: aes }, { data: benchSetting }, { data: audit }, { data: entities }] = await Promise.all([
    supabase
      .from("opportunities")
      .select(
        "id, name, stage, machines, amount, prob, source, close_date, created_at, ae_id, entities(name), profiles(full_name)",
      )
      .eq("state", "open")
      .returns<CockpitOpp[]>(),
    supabase.from("profiles").select("id, full_name").eq("role", "ae").order("full_name").returns<AeOption[]>(),
    supabase.from("settings").select("value").eq("key", "benchmarks").single(),
    supabase
      .from("audit_log")
      .select("id, at, type, detail, dir, delta_machines, delta_amount, profiles(full_name), opportunities(name, entities(name))")
      .order("at", { ascending: false })
      .limit(300)
      .returns<AuditRow[]>(),
    supabase.from("entities").select("owner_id, parc").returns<{ owner_id: string | null; parc: number | null }[]>(),
  ]);

  const benchmarks = (benchSetting?.value as Benchmarks) ?? DEFAULT_BENCHMARKS;

  const today = todayISO();
  await ensureAgingTasksForAll(supabase, opps ?? [], benchmarks, today);
  const { data: agingTasks } = await supabase
    .from("tasks")
    .select("opp_id, status, due")
    .eq("rule", "aging")
    .in("opp_id", (opps ?? []).map((o) => o.id))
    .returns<AgingTask[]>();

  const shift = (d: string, n: number) => {
    const x = new Date(d + "T12:00:00Z");
    x.setUTCDate(x.getUTCDate() + n);
    return x.toISOString().slice(0, 10);
  };
  const sinceDay = shift(today, -70);
  const since = `${sinceDay}T00:00:00Z`;
  const inDays = shift(today, 14);
  const [{ data: wAudit }, { data: wTasks }, { data: wMeetings }, { data: wQuotes }] = await Promise.all([
    supabase
      .from("audit_log")
      .select("at, type, detail, dir, from_stage, to_stage, delta_machines, delta_amount, opp_id, opportunities(name, ae_id, entities(name))")
      .in("type", ["stage_change", "opp_created", "opp_won", "opp_lost"])
      .gte("at", since)
      .order("at", { ascending: false })
      .limit(2000)
      .returns<WAudit[]>(),
    supabase
      .from("tasks")
      .select("owner_id, status, due, done_on, created_at, auto, title")
      .or(`status.eq.open,created_at.gte.${since},done_on.gte.${sinceDay}`)
      .limit(3000)
      .returns<WTask[]>(),
    supabase
      .from("meetings")
      .select("ae_id, date, title, with_who")
      .gte("date", sinceDay)
      .lte("date", inDays)
      .limit(3000)
      .returns<WMeeting[]>(),
    supabase
      .from("quotes")
      .select("ae_id, created_at, number, status, opportunities(name, entities(name))")
      .gte("created_at", since)
      .limit(1000)
      .returns<WQuote[]>(),
  ]);

  return (
    <CockpitView
      weekly={{ audit: wAudit ?? [], tasks: wTasks ?? [], meetings: wMeetings ?? [], quotes: wQuotes ?? [] }}
      agingTasks={agingTasks ?? []}
      entityParc={(entities ?? []).map((e) => ({ owner_id: e.owner_id, parc: e.parc ?? 0 }))}
      opps={opps ?? []}
      aes={aes ?? []}
      benchmarks={benchmarks}
      audit={audit ?? []}
      today={today}
    />
  );
}
