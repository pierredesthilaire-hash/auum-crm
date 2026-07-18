"use client";

import { useMemo, useRef, useState } from "react";
import { PSTATUS, pstatOf } from "@/lib/prospectStatus";
import { importProspectsCsv, logTouch, setProspectStatus, setProspectOwner, convertProspectToOpp } from "./actions";
import type { AeOption, CurrentUser, ProspectRow } from "./types";

export function ProspectsView({
  prospects,
  aes,
  currentUser,
}: {
  prospects: ProspectRow[];
  aes: AeOption[];
  currentUser: CurrentUser;
}) {
  const [aeFilter, setAeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stats = useMemo(() => {
    const byStatus = new Map<string, number>();
    for (const s of PSTATUS) byStatus.set(s.id, 0);
    let unassigned = 0;
    for (const p of prospects) {
      byStatus.set(p.status, (byStatus.get(p.status) ?? 0) + 1);
      if (!p.ae_id) unassigned++;
    }
    return { total: prospects.length, unassigned, byStatus };
  }, [prospects]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return prospects.filter((p) => {
      if (aeFilter === "NONE" && p.ae_id) return false;
      if (aeFilter !== "ALL" && aeFilter !== "NONE" && p.profiles?.full_name !== aeFilter) return false;
      if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
      if (q && !`${p.company} ${p.contact ?? ""} ${p.email ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [prospects, aeFilter, statusFilter, search]);

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
      <div className="mb-4 grid grid-cols-8 gap-2.5">
        <Stat v={stats.total} l="Prospects en base" />
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
        {currentUser.isDirection && (
          <>
            <span className="text-xs font-semibold">AE :</span>
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
          <h3 className="font-display mb-3 text-[13.5px] font-semibold">{filtered.length} prospect(s) affiché(s)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-[10.5px] uppercase text-[var(--muted)]">
                  <th className="pb-2">Société</th>
                  <th className="pb-2">Contact</th>
                  <th className="pb-2">Fonction</th>
                  <th className="pb-2">Email</th>
                  <th className="pb-2">Téléphone</th>
                  <th className="pb-2">AE</th>
                  <th className="pb-2">Statut</th>
                  <th className="pb-2 text-right">Touches</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 400).map((p) => (
                  <ProspectRowView key={p.id} p={p} aes={aes} currentUser={currentUser} />
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length > 400 && (
            <div className="mt-2 text-center text-[11px] text-[var(--muted)]">
              Affichage limité aux 400 premières lignes — affinez avec les filtres ou la recherche.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProspectRowView({ p, aes, currentUser }: { p: ProspectRow; aes: AeOption[]; currentUser: CurrentUser }) {
  const st = pstatOf(p.status);
  const [converting, setConverting] = useState(false);

  const handleConvert = async () => {
    if (p.status === "converti") return;
    setConverting(true);
    await convertProspectToOpp(p.id);
    setConverting(false);
  };

  return (
    <tr className="border-t" style={{ borderColor: "var(--line)" }}>
      <td className="py-1.5 font-semibold">{p.company}</td>
      <td className="py-1.5">{p.contact || "—"}</td>
      <td className="max-w-[150px] truncate py-1.5">{p.role || "—"}</td>
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

function Stat({ v, l }: { v: number; l: string }) {
  return (
    <div className="rounded-xl border bg-white p-2.5 text-center" style={{ borderColor: "var(--line)" }}>
      <div className="font-display text-[16px] font-bold">{v}</div>
      <div className="text-[9px] leading-tight text-[var(--muted)]">{l}</div>
    </div>
  );
}
