import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/currentUser";
import { todayISO } from "@/lib/dates";
import { DEFAULT_BENCHMARKS, type Benchmarks } from "@/lib/lifecycle";
import { CockpitView } from "./CockpitView";
import type { AeOption, AuditRow, CockpitOpp } from "./types";

export default async function CockpitPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();

  if (!user?.isDirection) {
    redirect("/dashboard");
  }

  const [{ data: opps }, { data: aes }, { data: benchSetting }, { data: audit }] = await Promise.all([
    supabase
      .from("opportunities")
      .select(
        "id, name, stage, machines, amount, prob, source, close_date, created_at, entities(name), profiles(full_name)",
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
  ]);

  const benchmarks = (benchSetting?.value as Benchmarks) ?? DEFAULT_BENCHMARKS;

  return (
    <CockpitView
      opps={opps ?? []}
      aes={aes ?? []}
      benchmarks={benchmarks}
      audit={audit ?? []}
      today={todayISO()}
    />
  );
}
