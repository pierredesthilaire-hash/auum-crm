"use client";

import { useMemo, useState } from "react";
import { SEG_LABEL, segmentOf, type SegConfig } from "@/lib/segments";
import { ClientDrawer } from "./ClientDrawer";
import type { AeOption, ContactRow, CurrentUser, EntityOpp, EntityRow, GroupOption } from "./types";

type SortKey = "name" | "parc";
type Sort = { key: SortKey; dir: "asc" | "desc" };

export function ClientsGrid({
  entities,
  opps,
  groups,
  aes,
  contacts,
  segConfig,
  currentUser,
}: {
  entities: EntityRow[];
  opps: EntityOpp[];
  groups: GroupOption[];
  aes: AeOption[];
  contacts: ContactRow[];
  segConfig: SegConfig;
  currentUser: CurrentUser;
}) {
  const [segFilter, setSegFilter] = useState<"ALL" | "smb" | "grand" | "cle">("ALL");
  const [aeFilter, setAeFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>({ key: "parc", dir: "desc" });
  const [openEntityId, setOpenEntityId] = useState<string | null>(null);

  const oppsByEntity = useMemo(() => {
    const map = new Map<string, EntityOpp[]>();
    for (const o of opps) {
      const arr = map.get(o.entity_id) ?? [];
      arr.push(o);
      map.set(o.entity_id, arr);
    }
    return map;
  }, [opps]);

  const contactsByEntity = useMemo(() => {
    const map = new Map<string, ContactRow[]>();
    for (const c of contacts) {
      const arr = map.get(c.entity_id) ?? [];
      arr.push(c);
      map.set(c.entity_id, arr);
    }
    return map;
  }, [contacts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = entities.filter((e) => {
      if (aeFilter !== "ALL" && e.profiles?.full_name !== aeFilter) return false;
      const seg = segmentOf(e.headcount, segConfig);
      if (segFilter !== "ALL" && seg !== segFilter) return false;
      if (q && !e.name.toLowerCase().includes(q)) return false;
      return true;
    });
    const sign = sort.dir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      if (sort.key === "parc") {
        const d = (a.parc || 0) - (b.parc || 0);
        if (d !== 0) return sign * d;
      }
      const byName = a.name.localeCompare(b.name, "fr");
      return sort.key === "name" ? sign * byName : byName;
    });
    return list;
  }, [entities, aeFilter, segFilter, search, segConfig, sort]);

  const totalMachines = useMemo(() => filtered.reduce((s, e) => s + (e.parc || 0), 0), [filtered]);

  const openEntity = openEntityId ? entities.find((e) => e.id === openEntityId) ?? null : null;

  const toggleSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "parc" ? "desc" : "asc" },
    );
  const arrow = (key: SortKey) => (sort.key === key ? (sort.dir === "asc" ? " ▲" : " ▼") : "");

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
        <span className="ml-2 text-xs font-semibold">Segment :</span>
        {(["ALL", "smb", "grand", "cle"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSegFilter(s)}
            className="rounded-full border px-3 py-1 text-xs font-semibold"
            style={
              segFilter === s
                ? { background: "var(--pine)", borderColor: "var(--pine)", color: "#fff" }
                : { borderColor: "var(--line)", color: "var(--muted)", background: "#fff" }
            }
          >
            {s === "ALL" ? "Tous" : SEG_LABEL[s]}
          </button>
        ))}
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un client…"
          className="input ml-auto"
          style={{ width: 220 }}
        />
      </div>

      <div className="mb-3 text-[11.5px] text-[var(--muted)]">
        {filtered.length} client(s) · {totalMachines.toLocaleString("fr-FR")} machines au total
      </div>

      {filtered.length ? (
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm" style={{ borderColor: "var(--line)" }}>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr
                className="text-left text-[11px] uppercase tracking-wide text-[var(--muted)]"
                style={{ background: "var(--bg)" }}
              >
                <th className="px-4 py-2.5 font-semibold">
                  <button onClick={() => toggleSort("name")} className="uppercase tracking-wide">
                    Client{arrow("name")}
                  </button>
                </th>
                <th className="w-[180px] px-4 py-2.5 text-right font-semibold">
                  <button onClick={() => toggleSort("parc")} className="uppercase tracking-wide">
                    Machines{arrow("parc")}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr
                  key={e.id}
                  onClick={() => setOpenEntityId(e.id)}
                  className="cursor-pointer border-t hover:bg-[var(--teal-soft)]"
                  style={{ borderColor: "var(--line)" }}
                >
                  <td className="px-4 py-2.5">
                    <span className="font-semibold">{e.name}</span>
                    {e.groups && <span className="ml-2 text-[11px] text-[var(--muted)]">🏛 {e.groups.name}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                    {(e.parc || 0).toLocaleString("fr-FR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border p-6 text-center text-sm text-[var(--muted)]" style={{ borderColor: "var(--line)" }}>
          Aucun client ne correspond à ces filtres.
        </div>
      )}

      {openEntity && (
        <ClientDrawer
          entity={openEntity}
          opps={oppsByEntity.get(openEntity.id) ?? []}
          contacts={contactsByEntity.get(openEntity.id) ?? []}
          groups={groups}
          aes={aes}
          currentUser={currentUser}
          segConfig={segConfig}
          onClose={() => setOpenEntityId(null)}
        />
      )}
    </div>
  );
}
