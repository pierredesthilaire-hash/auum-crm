"use client";

import { useMemo, useState } from "react";
import { keur, num, fdate } from "@/lib/format";
import type { AeOption, AuditRow } from "./types";

const JTYPES: Record<string, [string, string]> = {
  opp_created: ["Création", "#149E7E"],
  stage_change: ["Étape", "#3E6FA8"],
  field_change: ["Modification", "#7C8B9D"],
  opp_won: ["Gagnée", "#0E3F30"],
  opp_lost: ["Perdue", "#C24E3A"],
  parc_update: ["Parc", "#7B5EA7"],
  task: ["Tâche", "#C98A1B"],
};

const MONTH_LABELS = [
  "janv", "févr", "mars", "avr", "mai", "juin",
  "juil", "août", "sept", "oct", "nov", "déc",
];

export function JournalView({ audit, users }: { audit: AuditRow[]; users: AeOption[] }) {
  const [month, setMonth] = useState("ALL");
  const [userFilter, setUserFilter] = useState("ALL");
  const [type, setType] = useState("ALL");

  const months = useMemo(
    () => [...new Set(audit.map((a) => a.at.slice(0, 7)))].sort().reverse(),
    [audit],
  );

  const filtered = useMemo(
    () =>
      audit.filter((a) => {
        if (month !== "ALL" && a.at.slice(0, 7) !== month) return false;
        if (userFilter !== "ALL" && a.profiles?.full_name !== userFilter) return false;
        if (type !== "ALL" && a.type !== type) return false;
        return true;
      }),
    [audit, month, userFilter, type],
  );

  const created = filtered.filter((a) => a.type === "opp_created");
  const won = filtered.filter((a) => a.type === "opp_won");
  const lost = filtered.filter((a) => a.type === "opp_lost");
  const moves = filtered.filter((a) => a.type === "stage_change");
  const up = moves.filter((a) => a.dir === "up").length;
  const down = moves.filter((a) => a.dir === "down").length;
  const dMach =
    filtered.reduce((s, a) => s + (a.type === "field_change" ? a.delta_machines ?? 0 : 0), 0) +
    created.reduce((s, a) => s + (a.delta_machines ?? 0), 0);
  const dAmt =
    filtered.reduce((s, a) => s + (a.type === "field_change" ? a.delta_amount ?? 0 : 0), 0) +
    created.reduce((s, a) => s + (a.delta_amount ?? 0), 0);
  const wonMachines = won.reduce((s, a) => s + (a.delta_machines ?? 0), 0);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold">Période :</span>
        {["ALL", ...months].map((m) => (
          <Chip key={m} active={month === m} onClick={() => setMonth(m)}>
            {m === "ALL" ? "Tout" : monthLabel(m)}
          </Chip>
        ))}
        <span className="ml-2 text-xs font-semibold">Utilisateur :</span>
        {["ALL", ...users.map((u) => u.full_name)].map((u) => (
          <Chip key={u} active={userFilter === u} onClick={() => setUserFilter(u)}>
            {u === "ALL" ? "Tous" : u.split(" ")[0]}
          </Chip>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-7 gap-2.5">
        <Kpi v={created.length} l="Oppos créées" accent />
        <Kpi v={`${won.length} (${num(wonMachines)} mach.)`} l="Gagnées" accent />
        <Kpi v={lost.length} l="Perdues" amber={lost.length > 0} />
        <Kpi v={moves.length} l="Changements d'étape" />
        <Kpi v={`↑ ${up} / ↓ ${down}`} l="Avancées / reculs" />
        <Kpi v={`${dMach >= 0 ? "+" : ""}${num(dMach)}`} l="Machines nettes ajoutées" accent={dMach >= 0} amber={dMach < 0} />
        <Kpi v={`${dAmt >= 0 ? "+" : ""}${keur(dAmt)}`} l="Montant net ajouté" accent={dAmt >= 0} amber={dAmt < 0} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold">Type :</span>
        {["ALL", ...Object.keys(JTYPES)].map((t) => (
          <Chip key={t} active={type === t} onClick={() => setType(t)}>
            {t === "ALL" ? "Tous" : JTYPES[t][0]}
          </Chip>
        ))}
      </div>

      <div className="rounded-xl border bg-white p-4" style={{ borderColor: "var(--line)" }}>
        <h3 className="font-display mb-3 text-[13.5px] font-semibold">
          {filtered.length} événement(s){" "}
          <span className="text-[11px] font-normal text-[var(--muted)]">
            chaque modification est horodatée et attribuée
          </span>
        </h3>
        {!filtered.length ? (
          <div className="text-[12px] text-[var(--muted)]">
            Aucun événement sur ce périmètre. Le journal se remplit automatiquement à chaque action.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-[10.5px] uppercase text-[var(--muted)]">
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Utilisateur</th>
                  <th className="pb-2">Type</th>
                  <th className="pb-2">Opportunité</th>
                  <th className="pb-2">Détail</th>
                  <th className="pb-2 text-right">Δ mach.</th>
                  <th className="pb-2 text-right">Δ €</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 300).map((a) => {
                  const [d, h] = a.at.split("T");
                  const jt = JTYPES[a.type] ?? [a.type, "#7C8B9D"];
                  const client = a.opportunities?.entities?.name ?? a.opportunities?.name ?? "—";
                  return (
                    <tr key={a.id} className="border-t" style={{ borderColor: "var(--line)" }}>
                      <td className="whitespace-nowrap py-1.5">
                        {fdate(d)} <span className="text-[var(--muted)]">{h?.slice(0, 5)}</span>
                      </td>
                      <td className="py-1.5">{a.profiles?.full_name?.split(" ")[0] ?? "—"}</td>
                      <td className="py-1.5">
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                          style={{ background: jt[1] }}
                        >
                          {jt[0]}
                        </span>
                      </td>
                      <td className="max-w-[160px] truncate py-1.5 font-semibold">{client}</td>
                      <td className="max-w-[300px] truncate py-1.5">{a.detail}</td>
                      <td className="py-1.5 text-right">
                        {a.delta_machines ? (
                          <span style={{ color: a.delta_machines > 0 ? "var(--teal)" : "var(--red)" }}>
                            {a.delta_machines > 0 ? "+" : ""}
                            {a.delta_machines}
                          </span>
                        ) : (
                          ""
                        )}
                      </td>
                      <td className="py-1.5 text-right">
                        {a.delta_amount ? (
                          <span style={{ color: a.delta_amount > 0 ? "var(--teal)" : "var(--red)" }}>
                            {a.delta_amount > 0 ? "+" : ""}
                            {keur(a.delta_amount)}
                          </span>
                        ) : (
                          ""
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length > 300 && (
              <div className="mt-2 text-center text-[11px] text-[var(--muted)]">
                Affichage limité aux 300 derniers événements — affinez par période, utilisateur ou type.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function monthLabel(m: string): string {
  const [y, mo] = m.split("-");
  return `${MONTH_LABELS[+mo - 1]} ${y}`;
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full border px-3 py-1 text-xs font-semibold"
      style={
        active
          ? { background: "var(--pine)", borderColor: "var(--pine)", color: "#fff" }
          : { borderColor: "var(--line)", color: "var(--muted)", background: "#fff" }
      }
    >
      {children}
    </button>
  );
}

function Kpi({ v, l, accent, amber }: { v: string | number; l: string; accent?: boolean; amber?: boolean }) {
  return (
    <div className="rounded-xl border bg-white p-3" style={{ borderColor: "var(--line)" }}>
      <div
        className="font-display text-[16px] font-bold tracking-tight"
        style={{ color: amber ? "var(--amber)" : accent ? "var(--teal)" : "var(--ink)" }}
      >
        {v}
      </div>
      <div className="mt-0.5 text-[10px] leading-tight text-[var(--muted)]">{l}</div>
    </div>
  );
}
