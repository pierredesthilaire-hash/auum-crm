"use client";

import { useEffect, useState, useTransition } from "react";
import { addDaysISO, todayISO } from "@/lib/dates";
import { createTask } from "./actions";

type Item = { title: string; url: string; source: string; date: string };
type Company = { name: string; openOpp: boolean; stage: string | null; items: Item[] };
type SectorState = { status: "loading" } | { status: "ok"; items: Item[] } | { status: "off" } | { status: "error" };
type ClientsState =
  | { status: "loading"; companies: Company[] }
  | { status: "ok"; companies: Company[]; partial: boolean }
  | { status: "off" }
  | { status: "error" };

const fdate = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });

export function NewsPanel({ aeId, canCreateTasks }: { aeId: string; canCreateTasks: boolean }) {
  const [sector, setSector] = useState<SectorState>({ status: "loading" });
  const [clients, setClients] = useState<ClientsState>({ status: "loading", companies: [] });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await (await fetch("/api/news?scope=sector")).json();
        if (cancelled) return;
        if (r.error === "not_configured") setSector({ status: "off" });
        else if (r.error) setSector({ status: "error" });
        else setSector({ status: "ok", items: r.items ?? [] });
      } catch {
        if (!cancelled) setSector({ status: "error" });
      }
    })();
    (async () => {
      // Le serveur charge les sociétés par lots (quota API) : on relance tant qu'il en reste.
      for (let i = 0; i < 8 && !cancelled; i++) {
        try {
          const r = await (await fetch(`/api/news?scope=clients&ae=${aeId}`)).json();
          if (cancelled) return;
          if (r.error === "not_configured") return setClients({ status: "off" });
          if (r.error) return setClients({ status: "error" });
          const partial = (r.pending ?? 0) > 0 && !r.quota;
          setClients({ status: partial ? "loading" : "ok", companies: r.companies ?? [], partial } as ClientsState);
          if (!partial) return;
        } catch {
          if (!cancelled) setClients({ status: "error" });
          return;
        }
      }
      if (!cancelled) setClients((c) => (c.status === "loading" ? { status: "ok", companies: c.companies, partial: true } : c));
    })();
    return () => {
      cancelled = true;
    };
  }, [aeId]);

  return (
    <div className="mt-3.5 grid grid-cols-1 gap-3.5 lg:grid-cols-2">
      <div className="rounded-xl border bg-white p-4" style={{ borderColor: "var(--line)" }}>
        <h3 className="font-display mb-3 text-[13.5px] font-semibold">
          📰 Actualité du secteur{" "}
          <span className="text-[11px] font-normal text-[var(--muted)]">vaisselle réutilisable, loi AGEC, zéro déchet</span>
        </h3>
        {sector.status === "loading" && <Muted>Chargement…</Muted>}
        {sector.status === "off" && <NotConfigured />}
        {sector.status === "error" && <Muted>Actualités indisponibles pour le moment.</Muted>}
        {sector.status === "ok" &&
          (sector.items.length ? (
            <div className="space-y-2">
              {sector.items.map((a) => (
                <Article key={a.url} a={a} />
              ))}
            </div>
          ) : (
            <Muted>Aucun article récent trouvé.</Muted>
          ))}
      </div>

      <div className="rounded-xl border bg-white p-4" style={{ borderColor: "var(--line)" }}>
        <h3 className="font-display mb-3 text-[13.5px] font-semibold">
          🔎 Actualités de vos clients et opportunités{" "}
          <span className="text-[11px] font-normal text-[var(--muted)]">30 derniers jours · idées de relance</span>
        </h3>
        {clients.status === "off" && <NotConfigured />}
        {clients.status === "error" && <Muted>Actualités indisponibles pour le moment.</Muted>}
        {(clients.status === "loading" || clients.status === "ok") && (
          <>
            {clients.companies.length === 0 && clients.status === "loading" && <Muted>Recherche en cours…</Muted>}
            {clients.companies.length === 0 && clients.status === "ok" && <Muted>Aucune actualité récente sur vos sociétés.</Muted>}
            <div className="space-y-3">
              {clients.companies.slice(0, 12).map((c) => (
                <CompanyBlock key={c.name} c={c} aeId={aeId} canCreateTasks={canCreateTasks} />
              ))}
            </div>
            {clients.status === "loading" && clients.companies.length > 0 && (
              <div className="mt-2 text-[11px] text-[var(--muted)]">Recherche en cours sur le reste de vos sociétés…</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <div className="text-[12px] text-[var(--muted)]">{children}</div>;
}

function NotConfigured() {
  return <Muted>Actualités non activées : la clé GNews n&apos;est pas encore configurée.</Muted>;
}

function Article({ a }: { a: Item }) {
  return (
    <a href={a.url} target="_blank" rel="noreferrer" className="block rounded-lg border p-2 hover:bg-[var(--teal-soft)]" style={{ borderColor: "var(--line)" }}>
      <div className="text-[12.5px] font-semibold leading-snug">{a.title}</div>
      <div className="text-[11px] text-[var(--muted)]">
        {a.source} · {fdate(a.date)}
      </div>
    </a>
  );
}

function CompanyBlock({ c, aeId, canCreateTasks }: { c: Company; aeId: string; canCreateTasks: boolean }) {
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const makeTask = (a: Item) =>
    startTransition(async () => {
      const r = await createTask({
        title: `Relance — ${c.name} : ${a.title.slice(0, 70)}`,
        type: "Relance",
        due: addDaysISO(todayISO(), 2),
        note: `Actualité : ${a.title} (${a.source}) ${a.url}`,
        ownerId: aeId,
      });
      if (r.ok) setDone(a.url);
    });

  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-[12.5px] font-semibold">
        {c.name}
        {c.openOpp && (
          <span className="rounded-full px-1.5 py-0.5 text-[9.5px] font-bold" style={{ background: "var(--teal-soft)", color: "var(--teal)" }}>
            Opportunité{c.stage ? ` · ${c.stage}` : ""}
          </span>
        )}
      </div>
      <div className="space-y-1.5">
        {c.items.map((a) => (
          <div key={a.url} className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <Article a={a} />
            </div>
            {canCreateTasks && (
              <button
                onClick={() => makeTask(a)}
                disabled={pending || done === a.url}
                className="btn shrink-0 px-2 py-1 text-[10.5px]"
                title="Créer une tâche de relance à partir de cet article"
              >
                {done === a.url ? "✓ Tâche créée" : "💡 Tâche"}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
