"use client";

import { useMemo, useState } from "react";
import { keur, num, aeColor } from "@/lib/format";
import { STAGES } from "@/lib/stages";
import { computeLifecycle, type Benchmarks } from "@/lib/lifecycle";
import { NewTaskDrawer } from "../dashboard/NewTaskDrawer";
import { JournalView } from "./JournalView";
import type { AeOption, AgingTask, AuditRow, CockpitOpp, EntityParc } from "./types";

export function CockpitView({
  opps,
  aes,
  benchmarks,
  agingTasks,
  entityParc,
  audit,
  today,
}: {
  opps: CockpitOpp[];
  aes: AeOption[];
  benchmarks: Benchmarks;
  agingTasks: AgingTask[];
  entityParc: EntityParc[];
  audit: AuditRow[];
  today: string;
}) {
  const [tab, setTab] = useState<"vue" | "journal">("vue");
  const [aeFilter, setAeFilter] = useState("ALL");
  const [showTask, setShowTask] = useState(false);
  const [taskMsg, setTaskMsg] = useState<string | null>(null);

  const aeNames = aes.map((a) => a.full_name);

  const filtered = useMemo(
    () => opps.filter((o) => aeFilter === "ALL" || o.profiles?.full_name === aeFilter),
    [opps, aeFilter],
  );

  const lifecycles = useMemo(
    () => filtered.map((o) => ({ opp: o, lc: computeLifecycle(o, benchmarks, today) })),
    [filtered, benchmarks, today],
  );

  const tot = filtered.reduce((s, o) => s + o.amount, 0);
  const mach = filtered.reduce((s, o) => s + o.machines, 0);
  const aeFilterId = aes.find((a) => a.full_name === aeFilter)?.id;
  const parcTot = entityParc.filter((e) => aeFilter === "ALL" || e.owner_id === aeFilterId).reduce((s, e) => s + e.parc, 0);
  const taskByOpp = new Map(agingTasks.map((t) => [t.opp_id, t]));
  const aging = lifecycles.filter(({ lc }) => lc.aging).sort((a, b) => b.opp.amount - a.opp.amount);

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {(["vue", "journal"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className="rounded-full border px-3 py-1.5 text-xs font-semibold"
            style={
              tab === k
                ? { background: "var(--pine)", borderColor: "var(--pine)", color: "#fff" }
                : { borderColor: "var(--line)", color: "var(--muted)", background: "#fff" }
            }
          >
            {k === "vue" ? "Vue d'ensemble" : "Journal & évolutions du pipe"}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          {taskMsg && <span className="text-[11.5px] font-semibold" style={{ color: "var(--teal)" }}>{taskMsg}</span>}
          <button onClick={() => setShowTask(true)} className="btn-primary px-3 py-1.5 text-xs">
            ＋ Tâche pour un AE
          </button>
        </div>
      </div>
      {showTask && aes.length > 0 && (
        <NewTaskDrawer
          ownerId={aes.find((a) => a.full_name === aeFilter)?.id ?? aes[0].id}
          aes={aes}
          onClose={() => setShowTask(false)}
          onCreated={(name) => setTaskMsg(`Tâche créée${name ? ` pour ${name.split(" ")[0]}` : ""}`)}
        />
      )}

      {tab === "journal" ? (
        <JournalView audit={audit} users={aes} />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold">AE :</span>
            {["ALL", ...aeNames].map((a) => (
              <button
                key={a}
                onClick={() => setAeFilter(a)}
                className="rounded-full border px-3 py-1 text-xs font-semibold"
                style={
                  aeFilter === a
                    ? { background: "var(--pine)", borderColor: "var(--pine)", color: "#fff" }
                    : { borderColor: "var(--line)", color: "var(--muted)", background: "#fff" }
                }
              >
                {a === "ALL" ? "Toute l'équipe" : a}
              </button>
            ))}
          </div>

          <div className="mb-4 grid grid-cols-6 gap-2.5">
            <Kpi v={keur(tot)} l="Pipe total" />
            <Kpi v={num(mach)} l="Machines en pipe" />
            <Kpi v={num(parcTot)} l="Parc actuel (machines)" />
            <Kpi v={num(parcTot + mach)} l="Portefeuille estimé (parc + pipe)" accent />
            <Kpi v={filtered.length} l="Opportunités" />
            <Kpi v={aging.length} l={`Vieillissantes (âge > ${benchmarks.alertRatio}× cycle)`} amber={aging.length > 0} />
          </div>

          <div className="mb-3.5 grid grid-cols-2 gap-3.5">
            {/* Funnel par étape */}
            <div className="rounded-xl border bg-white p-4" style={{ borderColor: "var(--line)" }}>
              <h3 className="font-display mb-3 text-[13.5px] font-semibold">
                Funnel par étape <span className="text-[11px] font-normal text-[var(--muted)]">nombre · montant · machines</span>
              </h3>
              {(() => {
                const counts = STAGES.map((s) => filtered.filter((o) => o.stage === s.id).length);
                const maxN = Math.max(...counts, 1);
                return STAGES.map((s, i) => {
                  const oo = filtered.filter((o) => o.stage === s.id);
                  return (
                    <div key={s.id} className="mb-2.5 flex items-center gap-2.5">
                      <div className="w-[110px] shrink-0 text-[11.5px] font-semibold">{s.label}</div>
                      <div className="relative h-[22px] flex-1 rounded-md" style={{ background: "#F0F3EF" }}>
                        <div
                          className="flex h-full items-center rounded-md pl-2 text-[11px] font-semibold text-white"
                          style={{ background: s.color, width: `${(counts[i] / maxN) * 100}%`, minWidth: counts[i] ? 24 : 0 }}
                        >
                          {counts[i] || ""}
                        </div>
                      </div>
                      <div className="w-[130px] shrink-0 text-right text-[11px] text-[var(--muted)]">
                        {keur(oo.reduce((s2, o) => s2 + o.amount, 0))} · {num(oo.reduce((s2, o) => s2 + o.machines, 0))} mach.
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Pipe par AE */}
            <div className="rounded-xl border bg-white p-4" style={{ borderColor: "var(--line)" }}>
              <h3 className="font-display mb-3 text-[13.5px] font-semibold">
                Pipe par AE <span className="text-[11px] font-normal text-[var(--muted)]">montant total · nombre d&apos;opportunités</span>
              </h3>
              {(() => {
                const rows = aeNames
                  .map((a) => {
                    const oo = filtered.filter((o) => o.profiles?.full_name === a);
                    return {
                      a,
                      tot: oo.reduce((s, o) => s + o.amount, 0),
                      n: oo.length,
                    };
                  })
                  .filter((r) => r.n)
                  .sort((x, y) => y.tot - x.tot);
                const maxT = Math.max(...rows.map((r) => r.tot), 1);
                return rows.map((r) => {
                  const color = aeColor(r.a, aeNames);
                  return (
                    <div key={r.a} className="mb-2.5 flex items-center gap-2.5">
                      <div className="w-[100px] shrink-0 truncate text-[11.5px] font-semibold">{r.a.split(" ")[0]}</div>
                      <div className="relative h-[20px] flex-1 rounded-md" style={{ background: "#F0F3EF" }}>
                        <div
                          className="absolute inset-y-0 left-0 rounded-md"
                          style={{ background: color, width: `${(r.tot / maxT) * 100}%` }}
                        />
                      </div>
                      <div className="w-[150px] shrink-0 text-right text-[11px] text-[var(--muted)]">
                        {keur(r.tot)} · {r.n}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* Portefeuille par AE */}
          <div className="mb-3.5 rounded-xl border bg-white p-4" style={{ borderColor: "var(--line)" }}>
            <h3 className="font-display mb-3 text-[13.5px] font-semibold">
              Portefeuille par AE{" "}
              <span className="text-[11px] font-normal text-[var(--muted)]">parc actuel + machines en pipe</span>
            </h3>
            {(() => {
              const parcOf = (id: string | undefined) => entityParc.filter((e) => e.owner_id === id).reduce((s2, e) => s2 + e.parc, 0);
              const rows = aes.map((a) => {
                const pipe = opps.filter((o) => o.ae_id === a.id).reduce((s2, o) => s2 + o.machines, 0);
                const parc = parcOf(a.id);
                return { name: a.full_name.split(" ")[0], parc, pipe };
              });
              const totParc = entityParc.reduce((s2, e) => s2 + e.parc, 0);
              const totPipe = opps.reduce((s2, o) => s2 + o.machines, 0);
              const restParc = totParc - rows.reduce((s2, r) => s2 + r.parc, 0);
              const restPipe = totPipe - rows.reduce((s2, r) => s2 + r.pipe, 0);
              if (restParc || restPipe) rows.push({ name: "Direction / autres", parc: restParc, pipe: restPipe });
              return (
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="text-left text-[10.5px] uppercase text-[var(--muted)]">
                      <th className="pb-2">AE</th>
                      <th className="pb-2 text-right">Parc actuel</th>
                      <th className="pb-2 text-right">Machines en pipe</th>
                      <th className="pb-2 text-right">Portefeuille estimé</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.name} className="border-t" style={{ borderColor: "var(--line)" }}>
                        <td className="py-1.5 font-semibold">{r.name}</td>
                        <td className="py-1.5 text-right">{num(r.parc)}</td>
                        <td className="py-1.5 text-right">+ {num(r.pipe)}</td>
                        <td className="py-1.5 text-right font-semibold">{num(r.parc + r.pipe)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 font-semibold" style={{ borderColor: "var(--ink)" }}>
                      <td className="py-1.5">Total direction</td>
                      <td className="py-1.5 text-right">{num(totParc)}</td>
                      <td className="py-1.5 text-right">+ {num(totPipe)}</td>
                      <td className="py-1.5 text-right" style={{ color: "var(--teal)" }}>{num(totParc + totPipe)}</td>
                    </tr>
                  </tbody>
                </table>
              );
            })()}
          </div>

          {/* Vieillissantes */}
          {aging.length > 0 && (
            <div className="rounded-xl border bg-white p-4" style={{ borderColor: "var(--line)" }}>
              <h3 className="font-display mb-3 text-[13.5px] font-semibold">
                ⏳ Opportunités vieillissantes{" "}
                <span className="text-[11px] font-normal text-[var(--muted)]">
                  âge supérieur à {benchmarks.alertRatio}× le cycle de vente historique de leur source
                </span>
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="text-left text-[10.5px] uppercase text-[var(--muted)]">
                      <th className="pb-2">Client</th>
                      <th className="pb-2">Opportunité</th>
                      <th className="pb-2">AE</th>
                      <th className="pb-2">Source</th>
                      <th className="pb-2 text-right">Âge</th>
                      <th className="pb-2 text-right">Cycle réf.</th>
                      <th className="pb-2 text-right">Montant</th>
                      <th className="pb-2">Tâche</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aging.map(({ opp: o, lc }) => (
                      <tr key={o.id} className="border-t" style={{ borderColor: "var(--line)" }}>
                        <td className="py-1.5 font-semibold">{o.entities?.name}</td>
                        <td className="max-w-[220px] truncate py-1.5">{o.name}</td>
                        <td className="py-1.5">{o.profiles?.full_name?.split(" ")[0]}</td>
                        <td className="py-1.5">{lc.key}</td>
                        <td className="py-1.5 text-right font-semibold" style={{ color: "var(--red)" }}>
                          {lc.age} j
                        </td>
                        <td className="py-1.5 text-right">{num(lc.cycle)} j</td>
                        <td className="py-1.5 text-right">{keur(o.amount)}</td>
                        <td className="py-1.5">
                          {(() => {
                            const t = taskByOpp.get(o.id);
                            if (!t) return "—";
                            return t.status === "done" ? "✅ faite" : `à faire${t.due ? ` (${t.due.split("-").reverse().join("/")})` : ""}`;
                          })()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
                          </div>
          )}
        </>
      )}
    </div>
  );
}

function Kpi({ v, l, accent, amber }: { v: string | number; l: string; accent?: boolean; amber?: boolean }) {
  return (
    <div className="rounded-xl border bg-white p-3" style={{ borderColor: "var(--line)" }}>
      <div
        className="font-display text-[18px] font-bold tracking-tight"
        style={{ color: amber ? "var(--amber)" : accent ? "var(--teal)" : "var(--ink)" }}
      >
        {v}
      </div>
      <div className="mt-0.5 text-[10px] leading-tight text-[var(--muted)]">{l}</div>
    </div>
  );
}
