"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PSTATUS, pstatOf } from "@/lib/prospectStatus";
import {
  importProspectsCsv,
  logTouch,
  setProspectStatus,
  setProspectOwner,
  setNextActionDate,
  snoozeNextAction,
  convertProspectToOpp,
} from "./actions";
import type { AeOption, CurrentUser, ProspectRow } from "./types";

const PAGE_SIZE = 100;

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// groupe d'urgence : 0 = en retard, 1 = aujourd'hui, 2 = à venir (daté), 3 = sans date planifiée
function urgencyGroup(p: ProspectRow, today: string): number {
  if (!p.next_action_date) return 3;
  if (p.next_action_date < today) return 0;
  if (p.next_action_date === today) return 1;
  return 2;
}

export function ProspectsView({
  prospects,
  aes,
  currentUser,
}: {
  prospects: ProspectRow[];
  aes: AeOption[];
  currentUser: CurrentUser;
}) {
  const today = todayStr();
  const [aeFilter, setAeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [todayOnly, setTodayOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stats = useMemo(() => {
    const byStatus = new Map<string, number>();
    for (const s of PSTATUS) byStatus.set(s.id, 0);
    let unassigned = 0;
    let dueToday = 0;
    for (const p of prospects) {
      byStatus.set(p.status, (byStatus.get(p.status) ?? 0) + 1);
      if (!p.ae_id) unassigned++;
      if (urgencyGroup(p, today) <= 1) dueToday++;
    }
    return { total: prospects.length, unassigned, dueToday, byStatus };
  }, [prospects, today]);

  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = prospects.filter((p) => {
      if (aeFilter === "NONE" && p.ae_id) return false;
      if (aeFilter !== "ALL" && aeFilter !== "NONE" && p.profiles?.full_name !== aeFilter) return false;
      if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
      if (todayOnly && urgencyGroup(p, today) > 1) return false;
      if (q && !`${p.company} ${p.contact ?? ""} ${p.email ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
    list.sort((a, b) => {
      const ga = urgencyGroup(a, today);
      const gb = urgencyGroup(b, today);
      if (ga !== gb) return ga - gb;
      if (ga <= 2) return (a.next_action_date ?? "").localeCompare(b.next_action_date ?? "");
      return a.company.localeCompare(b.company);
    });
    return list;
  }, [prospects, aeFilter, statusFilter, todayOnly, search, today]);

  // repart à la page 1 à chaque changement de filtre
  useEffect(() => {
    setPage(0);
  }, [aeFilter, statusFilter, todayOnly, search]);

  const pageCount = Math.max(1, Math.ceil(filteredSorted.length / PAGE_SIZE));
  const pageItems = filteredSorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleImport = async (file: File) => {
    setImporting(true);
    setImportMsg(null);
    const formData = new FormData();
    formData.append("file", file);
    const r = await importProspectsCsv(formData);
    setImporting(false);
    setImportMsg(r.ok ? `${r.count} prospect(s) importé(s)` : (r.error ?? "Échec de l'import"));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div>
      <div className="mb-4 grid grid-cols-9 gap-2.5">
        <Stat v={stats.total} l="Prospects en base" />
        <Stat v={stats.dueToday} l="À traiter aujourd'hui" amber={stats.dueToday > 0} />
        <Stat v={stats.unassigned} l="Non affectés" />
        {PSTATUS.map((s) => (
          <Stat key={s.id} v={stats.byStatus.get(s.id) ?? 0} l={s.label} />
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImport(file);
          }}
        />
        <button onClick={() => fileInputRef.current?.click()} disabled={importing} className="btn-primary">
          {importing ? "Import en cours…" : "Importer une base (CSV)"}
        </button>
        {importMsg && <span className="text-[12px] text-[var(--muted)]">{importMsg}</span>}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Chip active={todayOnly} onClick={() => setTodayOnly((v) => !v)}>
          ⏰ À traiter aujourd&apos;hui{stats.dueToday ? ` (${stats.dueToday})` : ""}
        </Chip>
        {currentUser.isDirection && (
          <>
            <span className="ml-2 text-xs font-semibold">AE :</span>
            {["ALL", "NONE", ...aes.map((a) => a.full_name)].map((a) => (
              <Chip key={a} active={aeFilter === a} onClick={() => setAeFilter(a)}>
                {a === "ALL" ? "Tous" : a === "NONE" ? "Non affectés" : a.split(" ")[0]}
              </Chip>
            ))}
          </>
        )}
        <span className="ml-2 text-xs font-semibold">Statut :</span>
        {["ALL", ...PSTATUS.map((s) => s.id)].map((sid) => (
          <Chip key={sid} active={statusFilter === sid} onClick={() => setStatusFilter(sid)}>
            {sid === "ALL" ? "Tous" : pstatOf(sid).label}
          </Chip>
        ))}
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher…"
          className="input ml-auto"
          style={{ width: 220 }}
        />
      </div>

      {!prospects.length ? (
        <div className="rounded-xl border bg-white p-6 text-center text-sm text-[var(--muted)]" style={{ borderColor: "var(--line)" }}>
          Base prospects vide. Importez un CSV (colonnes reconnues automatiquement : société, contact, fonction,
          email, téléphone, ville, secteur, AE).
        </div>
      ) : (
        <div className="rounded-xl border bg-white p-4" style={{ borderColor: "var(--line)" }}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-[13.5px] font-semibold">
              {filteredSorted.length} prospect(s){" "}
              <span className="text-[11px] font-normal text-[var(--muted)]">
                triés par urgence de relance — en retard, puis aujourd&apos;hui, puis à venir
              </span>
            </h3>
            {pageCount > 1 && (
              <div className="flex items-center gap-2 text-[11px] text-[var(--muted)]">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="btn px-2 py-1 text-[11px]"
                >
                  ← Préc.
                </button>
                Page {page + 1} / {pageCount}
                <button
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  disabled={page >= pageCount - 1}
                  className="btn px-2 py-1 text-[11px]"
                >
                  Suiv. →
                </button>
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-[10.5px] uppercase text-[var(--muted)]">
                  <th className="pb-2">Société</th>
                  <th className="pb-2">Contact</th>
                  <th className="pb-2">Email</th>
                  <th className="pb-2">Téléphone</th>
                  <th className="pb-2">AE</th>
                  <th className="pb-2">Statut</th>
                  <th className="pb-2">Relance</th>
                  <th className="pb-2 text-right">Touches</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((p) => (
                  <ProspectRowView key={p.id} p={p} aes={aes} currentUser={currentUser} today={today} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ProspectRowView({
  p,
  aes,
  currentUser,
  today,
}: {
  p: ProspectRow;
  aes: AeOption[];
  currentUser: CurrentUser;
  today: string;
}) {
  const st = pstatOf(p.status);
  const [converting, setConverting] = useState(false);
  const group = urgencyGroup(p, today);

  const handleConvert = async () => {
    if (p.status === "converti") return;
    setConverting(true);
    await convertProspectToOpp(p.id);
    setConverting(false);
  };

  return (
    <tr
      className="border-t"
      style={{ borderColor: "var(--line)", background: group === 0 ? "#FBF1EF" : group === 1 ? "#FFF8EC" : undefined }}
    >
      <td className="py-1.5 font-semibold">{p.company}</td>
      <td className="py-1.5">{p.contact || "—"}</td>
      <td className="py-1.5">
        {p.email ? (
          <a href={`mailto:${p.email}`} style={{ color: "var(--blue)" }}>
            {p.email}
          </a>
        ) : (
          "—"
        )}
      </td>
      <td className="py-1.5">{p.phone || "—"}</td>
      <td className="py-1.5">
        {currentUser.isDirection ? (
          <select
            defaultValue={p.ae_id ?? ""}
            onChange={(e) => setProspectOwner(p.id, e.target.value || null)}
            className="input py-1 text-[11px]"
          >
            <option value="">—</option>
            {aes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.full_name.split(" ")[0]}
              </option>
            ))}
          </select>
        ) : (
          p.profiles?.full_name?.split(" ")[0] ?? "—"
        )}
      </td>
      <td className="py-1.5">
        <select
          defaultValue={p.status}
          onChange={(e) => setProspectStatus(p.id, e.target.value)}
          className="input py-1 text-[11px]"
          style={{ color: st.color }}
        >
          {PSTATUS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </td>
      <td className="py-1.5">
        <div className="flex items-center gap-1">
          <input
            type="date"
            defaultValue={p.next_action_date ?? ""}
            onChange={(e) => setNextActionDate(p.id, e.target.value || null)}
            className="input py-1 text-[11px]"
            style={{
              width: 128,
              color: group === 0 ? "var(--red)" : group === 1 ? "var(--amber)" : undefined,
              fontWeight: group <= 1 ? 700 : undefined,
            }}
          />
          <button onClick={() => snoozeNextAction(p.id, 1)} title="+1 jour" className="btn px-1.5 py-1 text-[10.5px]">
            +1j
          </button>
          <button onClick={() => snoozeNextAction(p.id, 7)} title="+7 jours" className="btn px-1.5 py-1 text-[10.5px]">
            +7j
          </button>
        </div>
      </td>
      <td className="py-1.5 text-right">{p.touches?.length ?? 0}</td>
      <td className="whitespace-nowrap py-1.5">
        <button
          title="Tracer un contact email"
          onClick={() => logTouch(p.id, "email")}
          className="btn px-1.5 py-1 text-[11px]"
        >
          ✉️
        </button>
        <button
          title="Tracer un contact téléphone"
          onClick={() => logTouch(p.id, "tel")}
          className="btn ml-1 px-1.5 py-1 text-[11px]"
        >
          📞
        </button>
        <button
          onClick={handleConvert}
          disabled={p.status === "converti" || converting}
          className="btn ml-1 px-2 py-1 text-[11px]"
        >
          {p.status === "converti" ? "Convertie" : converting ? "…" : "→ Oppo"}
        </button>
      </td>
    </tr>
  );
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

function Stat({ v, l, amber }: { v: number; l: string; amber?: boolean }) {
  return (
    <div className="rounded-xl border bg-white p-2.5 text-center" style={{ borderColor: "var(--line)" }}>
      <div className="font-display text-[16px] font-bold" style={{ color: amber ? "var(--amber)" : undefined }}>
        {v}
      </div>
      <div className="text-[9px] leading-tight text-[var(--muted)]">{l}</div>
    </div>
  );
}
