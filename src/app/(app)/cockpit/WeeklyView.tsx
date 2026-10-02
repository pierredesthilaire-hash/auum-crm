"use client";

import { useMemo, useState } from "react";
import { keur } from "@/lib/format";
import type { Benchmarks } from "@/lib/lifecycle";
import { buildSummary, isoWeekNumber, shiftWeek, summaryToText, weekEndOf, weekStartOf, weekStats, type WeeklyData } from "@/lib/weekly";
import type { AeOption } from "./types";

const fd = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });

export function WeeklyView({ data, aes, benchmarks, today }: { data: WeeklyData; aes: AeOption[]; benchmarks: Benchmarks; today: string }) {
  const thisWeek = weekStartOf(today);
  const [start, setStart] = useState(thisWeek);
  const [aeId, setAeId] = useState(aes[0]?.id ?? "");
  const [copied, setCopied] = useState(false);

  const team = useMemo(() => weekStats(data, start, null), [data, start]);
  const teamPrev = useMemo(() => weekStats(data, shiftWeek(start, -1), null), [data, start]);
  const rows = useMemo(
    () => aes.map((a) => ({ ae: a, s: weekStats(data, start, a.id) })),
    [aes, data, start],
  );
  const ae = aes.find((a) => a.id === aeId);
  const summary = useMemo(
    () => (ae ? buildSummary(data, start, ae, today, benchmarks) : null),
    [ae, data, start, today, benchmarks],
  );
  const isCurrent = start === thisWeek;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button onClick={() => setStart(shiftWeek(start, -1))} className="rounded-full border bg-white px-3 py-1 text-xs font-semibold" style={{ borderColor: "var(--line)" }}>←</button>
        <span className="text-[13px] font-semibold">
          Semaine {isoWeekNumber(start)} · {fd(start)} au {fd(weekEndOf(start))}
          {isCurrent && <span className="ml-1.5 font-normal text-[var(--muted)]">(en cours)</span>}
        </span>
        <button onClick={() => setStart(shiftWeek(start, 1))} disabled={isCurrent} className="rounded-full border bg-white px-3 py-1 text-xs font-semibold disabled:opacity-40" style={{ borderColor: "var(--line)" }}>→</button>
        {!isCurrent && <button onClick={() => setStart(thisWeek)} className="text-xs font-semibold underline">Revenir à cette semaine</button>}
      </div>

      <div className="mb-4 grid grid-cols-6 gap-2.5">
        <Kpi v={team.created.length} p={teamPrev.created.length} l="Opportunités créées" />
        <Kpi v={team.up} p={teamPrev.up} l="Avancées d'étape" />
        <Kpi v={team.down} p={teamPrev.down} l="Reculs d'étape" bad />
        <Kpi v={team.won.length} p={teamPrev.won.length} l={`Signées · ${team.wonMachines} machines`} good />
        <Kpi v={team.lost.length} p={teamPrev.lost.length} l={`Perdues · ${team.lostMachines} machines`} bad />
        <Kpi v={team.quotes.length} p={teamPrev.quotes.length} l="Devis émis" />
      </div>

      <div className="mb-3.5 grid grid-cols-2 gap-3.5">
        <div className="rounded-xl border bg-white p-4" style={{ borderColor: "var(--line)" }}>
          <h3 className="font-display mb-2 text-[13.5px] font-semibold">Passages d&apos;une étape à l&apos;autre</h3>
          {team.transitions.length === 0 ? (
            <p className="text-xs text-[var(--muted)]">Aucun changement d&apos;étape cette semaine.</p>
          ) : (
            <ul className="space-y-1 text-[12.5px]">
              {team.transitions.map((t) => (
                <li key={t.from + t.to} className="flex justify-between">
                  <span>{t.from} → {t.to}</span>
                  <b>{t.n} deal{t.n > 1 ? "s" : ""}</b>
                </li>
              ))}
            </ul>
          )}
          {team.moves.length > 0 && (
            <ul className="mt-3 space-y-0.5 border-t pt-2 text-[11.5px] text-[var(--muted)]" style={{ borderColor: "var(--line)" }}>
              {team.moves.map((m, i) => (
                <li key={i}>{m.client || m.opp} : {m.from} → {m.to}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border bg-white p-4" style={{ borderColor: "var(--line)" }}>
          <h3 className="font-display mb-2 text-[13.5px] font-semibold">Deals sortis du pipe</h3>
          {team.won.length + team.lost.length === 0 ? (
            <p className="text-xs text-[var(--muted)]">Aucune signature ni perte cette semaine.</p>
          ) : (
            <ul className="space-y-1 text-[12.5px]">
              {team.won.map((e, i) => (
                <li key={"w" + i}><span style={{ color: "var(--teal)" }} className="font-semibold">Signé</span> · {e.client || e.opp} · {e.machines} machines · {keur(e.amount)}</li>
              ))}
              {team.lost.map((e, i) => (
                <li key={"l" + i}><span className="font-semibold" style={{ color: "#B4452F" }}>Perdu</span> · {e.client || e.opp} · {e.machines} machines · {keur(e.amount)}{e.comment ? ` · ${e.comment}` : ""}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mb-3.5 rounded-xl border bg-white p-4" style={{ borderColor: "var(--line)" }}>
        <h3 className="font-display mb-2 text-[13.5px] font-semibold">Activité par AE</h3>
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-left text-[var(--muted)]">
              {["AE", "Créées", "Avancées", "Reculs", "Signées", "Perdues", "RDV", "Devis", "Tâches faites"].map((h) => (
                <th key={h} className="py-1 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ ae: a, s }) => (
              <tr key={a.id} className="border-t" style={{ borderColor: "var(--line)" }}>
                <td className="py-1.5 font-semibold">{a.full_name}</td>
                <td>{s.created.length}</td><td>{s.up}</td><td>{s.down}</td>
                <td>{s.won.length} ({s.wonMachines} m.)</td><td>{s.lost.length}</td>
                <td>{s.meetings.length}</td><td>{s.quotes.length}</td><td>{s.tasksDone}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border bg-white p-4" style={{ borderColor: "var(--line)" }}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="font-display mr-2 text-[13.5px] font-semibold">Résumé pour le point individuel</h3>
          {aes.map((a) => (
            <button
              key={a.id}
              onClick={() => setAeId(a.id)}
              className="rounded-full border px-3 py-1 text-xs font-semibold"
              style={aeId === a.id ? { background: "var(--pine)", borderColor: "var(--pine)", color: "#fff" } : { borderColor: "var(--line)", color: "var(--muted)", background: "#fff" }}
            >
              {a.full_name}
            </button>
          ))}
          {summary && (
            <button
              className="ml-auto text-xs font-semibold underline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(summaryToText(summary));
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {}
              }}
            >
              {copied ? "Copié ✓" : "Copier le résumé"}
            </button>
          )}
        </div>
        {summary && (
          <div>
            <div className="mb-2 text-[13px] font-semibold">{summary.title}</div>
            {summary.sections.map((sec) => (
              <div key={sec.heading} className="mb-3">
                <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">{sec.heading}</div>
                <ul className="space-y-0.5 text-[12.5px]">
                  {sec.lines.map((l, i) => (
                    <li key={i} className={l.startsWith("•") ? "pl-3 text-[var(--muted)]" : ""}>{l}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-[11px] text-[var(--muted)]">
          L&apos;historique des changements d&apos;étape s&apos;enrichit au fil du temps : les premières semaines peuvent sembler peu fournies.
        </p>
      </div>
    </div>
  );
}

function Kpi({ v, p, l, good, bad }: { v: number; p: number; l: string; good?: boolean; bad?: boolean }) {
  const d = v - p;
  return (
    <div className="rounded-xl border bg-white p-3" style={{ borderColor: "var(--line)" }}>
      <div className="font-display text-xl font-bold" style={{ color: good ? "var(--teal)" : bad && v > 0 ? "#B4452F" : undefined }}>{v}</div>
      <div className="text-[11px] text-[var(--muted)]">{l}</div>
      <div className="text-[10.5px] text-[var(--muted)]">{d === 0 ? "= sem. préc." : `${d > 0 ? "+" : ""}${d} vs sem. préc.`}</div>
    </div>
  );
}
