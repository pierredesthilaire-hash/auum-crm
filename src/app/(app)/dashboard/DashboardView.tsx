"use client";

import { ForecastPanel } from "@/components/ForecastPanel";

import { useState } from "react";
import Link from "next/link";
import { keur, fdate } from "@/lib/format";
import { syncOutlook } from "./actions";
import { TaskList } from "./TaskList";
import { NewTaskDrawer } from "./NewTaskDrawer";
import { NewsPanel } from "./NewsPanel";
import type { AeOption, MeetingRow, OppKpi, TaskRow } from "./types";

export function DashboardView({
  targetAe,
  aes,
  isDirection,
  openOpps,
  wonMachines,
  wonCount,
  meetings,
  tasks,
  today,
  parc,
  isOwn,
  outlookConnected,
  outlookStatus,
}: {
  targetAe: AeOption;
  aes: AeOption[];
  isDirection: boolean;
  openOpps: OppKpi[];
  wonMachines: number;
  wonCount: number;
  meetings: MeetingRow[];
  tasks: TaskRow[];
  today: string;
  parc: number;
  isOwn: boolean;
  outlookConnected: boolean;
  outlookStatus: string | null;
}) {
  const [showNewTask, setShowNewTask] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(
    outlookStatus === "ok"
      ? "Outlook connecté. Cliquez sur « Synchroniser » pour charger vos RDV."
      : outlookStatus === "error"
        ? "La connexion à Outlook a échoué. Réessayez."
        : outlookStatus === "config"
          ? "La connexion Outlook n'est pas encore configurée côté CRM."
          : null,
  );
  const doSync = async () => {
    setSyncing(true);
    const r = await syncOutlook();
    setSyncing(false);
    setSyncMsg(r.ok ? `${r.count} RDV synchronisé(s) (7 prochains jours).` : (r.error ?? "Échec de la synchronisation"));
  };

  const pipeAmount = openOpps.reduce((s, o) => s + o.amount, 0);
  const pipeMachines = openOpps.reduce((s, o) => s + o.machines, 0);
  const nextClose = [...openOpps]
    .filter((o) => o.close_date)
    .sort((a, b) => (a.close_date! < b.close_date! ? -1 : 1))[0];
  const nextCloseLate = !!nextClose && nextClose.close_date! < today;

  const manualTasks = tasks.filter((t) => !t.auto);
  const autoCount = tasks.length - manualTasks.length;
  const overdueCount = manualTasks.filter((t) => t.due && t.due < today).length;
  const todayCount = manualTasks.filter((t) => t.due === today).length;

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";

  return (
    <div>
      {isDirection && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold">AE :</span>
          {aes.map((a) => (
            <Link
              key={a.id}
              href={`/dashboard?ae=${a.id}`}
              className="rounded-full border px-3 py-1 text-xs font-semibold"
              style={
                a.id === targetAe.id
                  ? { background: "var(--pine)", borderColor: "var(--pine)", color: "#fff" }
                  : { borderColor: "var(--line)", color: "var(--muted)", background: "#fff" }
              }
            >
              {a.full_name.split(" ")[0]}
            </Link>
          ))}
        </div>
      )}

      <div className="mb-4">
        <div className="font-display text-lg font-semibold">
          {greet} {targetAe.full_name.split(" ")[0]} 👋
        </div>
        <div className="text-xs text-[var(--muted)]">
          Voici votre journée du{" "}
          {new Date(today + "T00:00:00").toLocaleDateString("fr-FR", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
          .
        </div>
      </div>

      <ForecastPanel opps={openOpps} today={today} parc={parc} />

      <div className="mb-4 grid grid-cols-6 gap-2.5">
        <Kpi v={openOpps.length} l="Oppos ouvertes" />
        <Kpi v={keur(pipeAmount)} l="Pipe total" accent />
        <Kpi v={pipeMachines} l="Machines en pipe" accent />
        <Kpi v={wonCount} l="Ventes signées" />
        <Kpi v={wonMachines} l="Machines vendues" />
        <Kpi v={nextClose ? fdate(nextClose.close_date) : "—"} l="Prochain closing" amber={nextCloseLate} />
      </div>

      <div className="grid grid-cols-[1fr_1.25fr] gap-3.5">
        {/* RDV du jour */}
        <div className="rounded-xl border bg-white p-4" style={{ borderColor: "var(--line)" }}>
          <h3 className="font-display mb-3 flex items-center gap-2 text-[13.5px] font-semibold">
            📅 Mes RDV du jour
            <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold" style={{ background: "var(--teal-soft)", color: "var(--teal)" }}>
              Outlook
            </span>
          </h3>
          {!meetings.length ? (
            <div className="text-[12px] text-[var(--muted)]">Aucun RDV aujourd&apos;hui.</div>
          ) : (
            <div className="space-y-2">
              {meetings.map((m) => (
                <div key={m.id} className="flex gap-3 rounded-lg border p-2" style={{ borderColor: "var(--line)" }}>
                  <div className="w-14 shrink-0 text-[11px] font-semibold text-[var(--muted)]">
                    {m.start_time?.slice(0, 5)}
                    <br />
                    {m.end_time?.slice(0, 5)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-semibold">{m.title}</div>
                    <div className="truncate text-[11px] text-[var(--muted)]">
                      {[m.with_who, m.place].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {isOwn && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg p-2.5 text-[11px]" style={{ background: "var(--bg)" }}>
              {outlookConnected ? (
                <>
                  <button onClick={doSync} disabled={syncing} className="rounded-full border px-3 py-1 font-semibold" style={{ borderColor: "var(--line)", background: "#fff" }}>
                    {syncing ? "Synchronisation…" : "🔄 Synchroniser mon Outlook"}
                  </button>
                  <a href="/api/outlook/connect" className="text-[var(--muted)] underline">
                    Reconnecter
                  </a>
                </>
              ) : (
                <a href="/api/outlook/connect" className="rounded-full border px-3 py-1 font-semibold" style={{ borderColor: "var(--pine)", background: "var(--pine)", color: "#fff" }}>
                  Connecter mon Outlook
                </a>
              )}
              {syncMsg && <span className="text-[var(--muted)]">{syncMsg}</span>}
            </div>
          )}
        </div>

        {/* Tâches */}
        <div className="rounded-xl border bg-white p-4" style={{ borderColor: "var(--line)" }}>
          <div className="mb-3 flex items-center gap-2">
            <h3 className="font-display text-[13.5px] font-semibold">✓ Mes tâches</h3>
            <span className="text-[11px] text-[var(--muted)]">
              {overdueCount > 0 && (
                <span className="font-bold" style={{ color: "var(--red)" }}>
                  {overdueCount} en retard ·{" "}
                </span>
              )}
              {todayCount} aujourd&apos;hui · {manualTasks.length} à faire{autoCount > 0 ? ` · ${autoCount} relances auto` : ""}
            </span>
            <button onClick={() => setShowNewTask(true)} className="btn-primary ml-auto px-3 py-1.5 text-[11.5px]">
              ＋ Tâche
            </button>
          </div>

          <TaskList tasks={tasks} today={today} />
        </div>
      </div>

      <NewsPanel aeId={targetAe.id} canCreateTasks />

      {showNewTask && <NewTaskDrawer ownerId={targetAe.id} onClose={() => setShowNewTask(false)} />}
    </div>
  );
}

function Kpi({ v, l, accent, amber }: { v: string | number; l: string; accent?: boolean; amber?: boolean }) {
  return (
    <div className="rounded-xl border bg-white p-3" style={{ borderColor: "var(--line)" }}>
      <div
        className="font-display text-[19px] font-bold tracking-tight"
        style={{ color: amber ? "var(--amber)" : accent ? "var(--teal)" : "var(--ink)" }}
      >
        {v}
      </div>
      <div className="mt-0.5 text-[10.5px] leading-tight text-[var(--muted)]">{l}</div>
    </div>
  );
}
