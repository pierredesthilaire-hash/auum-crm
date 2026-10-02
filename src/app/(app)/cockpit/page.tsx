import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/currentUser";
import { todayISO } from "@/lib/dates";
import { DEFAULT_BENCHMARKS, type Benchmarks } from "@/lib/lifecycle";
import { ensureAgingTasksForAll } from "../dashboard/autoTasks";
import { CockpitView } from "./CockpitView";
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

  return (
    <CockpitView
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
