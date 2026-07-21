"use client";

import { useMemo, useState } from "react";
import { STAGES, stageOf } from "@/lib/stages";
import { keur, fdate, initials, aeColor } from "@/lib/format";
import { MEDDIC_FIELDS, isMeddicComplete, meddicRequired, type MeddicKey } from "@/lib/meddic";
import { changeStage } from "./actions";
import { ConfirmDialog, type ConfirmRequest } from "./ConfirmDialog";
import { OppDrawer } from "./OppDrawer";
import type { AeOption, CurrentUser, OppRow } from "./types";

export function PipeBoard({
  initialOpps,
  aes,
  entityNames,
  currentUser,
}: {
  initialOpps: OppRow[];
  aes: AeOption[];
  entityNames: string[];
  currentUser: CurrentUser;
}) {
  const opps = initialOpps;
  const [aeFilter, setAeFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<{ mode: "view"; opp: OppRow } | { mode: "create" } | null>(null);
  const [confirmReq, setConfirmReq] = useState<ConfirmRequest | null>(null);
  const [confirmSeq, setConfirmSeq] = useState(0);

  const today = new Date().toISOString().slice(0, 10);

  const confirm = (
    req: Omit<ConfirmRequest, "onConfirm" | "onCancel">,
  ): Promise<{ ok: boolean; comment: string; extraChecked: boolean }> => {
    return new Promise((resolve) => {
      setConfirmSeq((n) => n + 1);
      setConfirmReq({
        ...req,
        onConfirm: (r) => {
          setConfirmReq(null);
          resolve({ ok: true, ...r });
        },
        onCancel: () => {
          setConfirmReq(null);
          resolve({ ok: false, comment: "", extraChecked: false });
        },
      });
    });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return opps.filter((o) => {
      if (aeFilter !== "ALL" && o.profiles?.full_name !== aeFilter) return false;
      if (q && !(o.entities?.name.toLowerCase().includes(q) || o.name.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [opps, aeFilter, search]);

  const handleDrop = async (stageId: string, id: string) => {
    setDragOverStage(null);
    setDraggingId(null);
    if (!id) return;
    const opp = opps.find((o) => o.id === id);
    if (!opp || opp.stage === stageId) return;

    const from = stageOf(opp.stage)!;
    const to = stageOf(stageId)!;
    const stages = STAGES.map((s) => s.id);
    const dir = stages.indexOf(to.id) > stages.indexOf(from.id) ? "up" : "down";

    if (dir === "up" && !oppMeddicOk(opp)) {
      await confirm({
        title: "MEDDIC incomplet",
        alertOnly: true,
        message: (
          <>
            <b>{opp.entities?.name}</b> — {opp.name} compte {opp.machines} machines (plus de 5) :
            complétez les 6 champs MEDDIC dans la fiche avant de faire avancer l&apos;étape.
          </>
        ),
      });
      return;
    }

    const r = await confirm({
      title: "Changement d'étape",
      withComment: true,
      message: (
        <>
          Confirmez-vous le passage de <b>{opp.entities?.name}</b> — {opp.name}
          <br />
          de <b style={{ color: from.color }}>{from.label}</b> vers{" "}
          <b style={{ color: to.color }}>{to.label}</b> ?
          {dir === "down" && (
            <>
              <br />
              <span style={{ color: "var(--red)", fontWeight: 600 }}>
                ⚠️ Recul dans le pipeline — précisez la raison en commentaire.
              </span>
            </>
          )}
        </>
      ),
    });
    if (r.ok) {
      const res = await changeStage(opp.id, stageId, r.comment);
      if (!res.ok && res.error) {
        await confirm({ title: "Étape non modifiée", alertOnly: true, message: res.error });
      }
    }
  };

  function oppMeddicOk(o: OppRow): boolean {
    if (!meddicRequired(o.machines)) return true;
    const fields = Object.fromEntries(
      MEDDIC_FIELDS.map((f) => [f.key, o[`meddic_${f.key}`]]),
    ) as Record<MeddicKey, string | null>;
    return isMeddicComplete(fields);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {currentUser.isDirection && (
          <>
            <span className="text-xs font-semibold">AE :</span>
            {["ALL", ...aes.map((a) => a.full_name)].map((a) => (
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
                {a === "ALL" ? "Tous" : a.split(" ")[0]}
              </button>
            ))}
          </>
        )}
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un client ou une opportunité…"
          className="input"
          style={{ width: 240 }}
        />
        <button onClick={() => setDrawer({ mode: "create" })} className="btn-primary ml-auto">
          ＋ Nouvelle opportunité
        </button>
      </div>

      <div className="grid grid-cols-5 gap-3">
        {STAGES.map((st) => {
          const colOpps = filtered.filter((o) => o.stage === st.id).sort((a, b) => b.amount - a.amount);
          const sumAmount = colOpps.reduce((s, o) => s + o.amount, 0);
          const sumMachines = colOpps.reduce((s, o) => s + o.machines, 0);
          const isOver = dragOverStage === st.id;

          return (
            <div
              key={st.id}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverStage(st.id);
              }}
              onDragLeave={() => setDragOverStage((s) => (s === st.id ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(st.id, e.dataTransfer.getData("text/plain"));
              }}
              className="flex min-h-[200px] flex-col rounded-xl p-2 transition-colors"
              style={{
                background: isOver ? "var(--teal-soft)" : "transparent",
                outline: isOver ? `2px dashed var(--teal)` : "none",
              }}
            >
              <div className="mb-1 flex items-center gap-2 px-1">
                <span className="h-2 w-2 rounded-full" style={{ background: st.color }} />
                <b className="text-[13px]">{st.label}</b>
                <span className="ml-auto text-[11px] text-[var(--muted)]">{colOpps.length}</span>
              </div>
              <div className="mb-2 px-1 text-[11px] text-[var(--muted)]">
                {keur(sumAmount)} · {sumMachines} machines
              </div>

              <div className="flex flex-1 flex-col gap-2">
                {colOpps.map((o) => {
                  const late = o.close_date && o.close_date < today;
                  return (
                    <div
                      key={o.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", o.id);
                        setDraggingId(o.id);
                      }}
                      onDragEnd={() => setDraggingId(null)}
                      onClick={() => setDrawer({ mode: "view", opp: o })}
                      className="cursor-pointer rounded-lg border bg-white p-2.5 shadow-sm transition-opacity"
                      style={{
                        borderColor: "var(--line)",
                        opacity: draggingId === o.id ? 0.4 : 1,
                      }}
                    >
                      <div className="text-[12.5px] font-semibold">{o.entities?.name}</div>
                      <div className="mb-1.5 text-[11.5px] text-[var(--muted)]">{o.name}</div>
                      <div className="flex flex-wrap items-center gap-1">
                        <Tag>{o.machines} mach.</Tag>
                        <Tag money>{keur(o.amount)}</Tag>
                        <Tag>{o.prob} %</Tag>
                        {!oppMeddicOk(o) && <Tag late>⚠ MEDDIC</Tag>}
                        {late ? (
                          <Tag late>⏰ {fdate(o.close_date)}</Tag>
                        ) : o.close_date ? (
                          <Tag>{fdate(o.close_date)}</Tag>
                        ) : null}
                        {o.profiles?.full_name && (
                          <span
                            title={o.profiles.full_name}
                            className="ml-auto flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white"
                            style={{
                              background: aeColor(
                                o.profiles.full_name,
                                aes.map((a) => a.full_name),
                              ),
                            }}
                          >
                            {initials(o.profiles.full_name)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {drawer && (
        <OppDrawer
          opp={drawer.mode === "view" ? drawer.opp : null}
          aes={aes}
          entityNames={entityNames}
          currentUser={currentUser}
          onClose={() => setDrawer(null)}
          confirm={confirm}
        />
      )}

      <ConfirmDialog key={confirmSeq} request={confirmReq} />
    </div>
  );
}

function Tag({
  children,
  money,
  late,
}: {
  children: React.ReactNode;
  money?: boolean;
  late?: boolean;
}) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
      style={{
        background: late ? "#FBEAE6" : money ? "var(--teal-soft)" : "#F0F3EF",
        color: late ? "var(--red)" : money ? "var(--teal)" : "var(--muted)",
      }}
    >
      {children}
    </span>
  );
}
