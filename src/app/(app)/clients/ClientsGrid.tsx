"use client";

import { useMemo, useState } from "react";
import { keur, initials, aeColor } from "@/lib/format";
import { SEG_LABEL, SEG_COLOR, segmentOf, type SegConfig } from "@/lib/segments";
import { ClientDrawer } from "./ClientDrawer";
import type { AeOption, ContactRow, CurrentUser, EntityOpp, EntityRow, GroupOption, NewsRow } from "./types";

export function ClientsGrid({
  entities,
  opps,
  groups,
  aes,
  news,
  contacts,
  segConfig,
  currentUser,
}: {
  entities: EntityRow[];
  opps: EntityOpp[];
  groups: GroupOption[];
  aes: AeOption[];
  news: NewsRow[];
  contacts: ContactRow[];
  segConfig: SegConfig;
  currentUser: CurrentUser;
}) {
  const [segFilter, setSegFilter] = useState<"ALL" | "smb" | "grand" | "cle">("ALL");
  const [aeFilter, setAeFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [openEntityId, setOpenEntityId] = useState<string | null>(null);

  const statsByEntity = useMemo(() => {
    const map = new Map<string, { n: number; amount: number; machines: number; oo: EntityOpp[] }>();
    for (const o of opps) {
      const s = map.get(o.entity_id) ?? { n: 0, amount: 0, machines: 0, oo: [] };
      s.n += 1;
      s.amount += o.amount;
      s.machines += o.machines;
      s.oo.push(o);
      map.set(o.entity_id, s);
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

  const newsByEntity = useMemo(() => {
    const map = new Map<string, NewsRow[]>();
    for (const n of news) {
      const arr = map.get(n.entity_id) ?? [];
      arr.push(n);
      map.set(n.entity_id, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => b.date.localeCompare(a.date));
    return map;
  }, [news]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = entities.filter((e) => {
      if (aeFilter !== "ALL" && e.profiles?.full_name !== aeFilter) return false;
      const seg = segmentOf(e.headcount, segConfig);
      if (segFilter !== "ALL" && seg !== segFilter) return false;
      if (q && !e.name.toLowerCase().includes(q)) return false;
      return true;
    });
    list.sort((a, b) => {
      const na = (newsByEntity.get(a.id)?.length ?? 0) > 0 ? 1 : 0;
      const nb = (newsByEntity.get(b.id)?.length ?? 0) > 0 ? 1 : 0;
      if (na !== nb) return nb - na;
      const sa = statsByEntity.get(a.id)?.amount ?? 0;
      const sb = statsByEntity.get(b.id)?.amount ?? 0;
      return sb - sa;
    });
    return list;
  }, [entities, aeFilter, segFilter, search, segConfig, newsByEntity, statsByEntity]);

  const openEntity = openEntityId ? entities.find((e) => e.id === openEntityId) ?? null : null;

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
        {filtered.length} client(s) — les comptes avec une actualité récente remontent en premier.
      </div>

      <div className="grid grid-cols-3 gap-3">
        {filtered.slice(0, 120).map((e) => {
          const st = statsByEntity.get(e.id);
          const seg = segmentOf(e.headcount, segConfig);
          const nn = newsByEntity.get(e.id);
          const owner = e.profiles?.full_name;

          return (
            <div
              key={e.id}
              onClick={() => setOpenEntityId(e.id)}
              className="cursor-pointer rounded-xl border bg-white p-4 shadow-sm"
              style={{ borderColor: "var(--line)" }}
            >
              <div className="mb-2 flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-semibold">{e.name}</div>
                  {e.groups && <div className="text-[10.5px] text-[var(--muted)]">🏛 {e.groups.name}</div>}
                </div>
                {seg && (
                  <span
                    className="rounded-full px-2 py-0.5 text-[9.5px] font-bold text-white"
                    style={{ background: SEG_COLOR[seg] }}
                  >
                    {SEG_LABEL[seg]}
                  </span>
                )}
              </div>

              <div className="mb-2 grid grid-cols-4 gap-1 text-center">
                <Stat v={e.parc || 0} l="Parc" />
                <Stat v={st?.n ?? 0} l="Oppos" />
                <Stat v={st?.n ? keur(st.amount) : "—"} l="Pipe" />
                <Stat v={contactsByEntity.get(e.id)?.length ?? 0} l="Contacts" />
              </div>

              {nn && nn.length > 0 && (
                <div
                  className="mb-2 rounded-lg p-2 text-[10.5px] leading-snug"
                  style={{ background: "var(--teal-soft)" }}
                >
                  <b>📰 {nn[0].signal}</b> · {nn[0].title.length > 80 ? nn[0].title.slice(0, 78) + "…" : nn[0].title}
                </div>
              )}

              <div className="flex items-center gap-2">
                {owner ? (
                  <>
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white"
                      style={{ background: aeColor(owner, aes.map((a) => a.full_name)) }}
                    >
                      {initials(owner)}
                    </span>
                    <span className="text-[10.5px] text-[var(--muted)]">{owner.split(" ")[0]}</span>
                  </>
                ) : (
                  <span className="text-[10.5px] text-[var(--muted)]">non attribué</span>
                )}
                <span className="ml-auto text-[10.5px] font-bold" style={{ color: "var(--teal)" }}>
                  Ouvrir →
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {!filtered.length && (
        <div className="rounded-xl border p-6 text-center text-sm text-[var(--muted)]" style={{ borderColor: "var(--line)" }}>
          Aucun client ne correspond à ces filtres.
        </div>
      )}
      {filtered.length > 120 && (
        <div className="mt-3 text-center text-xs text-[var(--muted)]">
          Affichage limité à 120 cartes — affinez la recherche.
        </div>
      )}

      {openEntity && (
        <ClientDrawer
          entity={openEntity}
          opps={statsByEntity.get(openEntity.id)?.oo ?? []}
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

function Stat({ v, l }: { v: string | number; l: string }) {
  return (
    <div>
      <div className="font-display text-[15px] font-bold">{v}</div>
      <div className="text-[9px] text-[var(--muted)]">{l}</div>
    </div>
  );
}
