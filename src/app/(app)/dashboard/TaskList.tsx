"use client";

import { useState, useTransition } from "react";
import { fdate } from "@/lib/format";
import { addDaysISO } from "@/lib/dates";
import { dismissTask, markTaskDone, snoozeTask, updateTask } from "./actions";
import type { TaskRow } from "./types";

export const TASK_TYPES = ["Rappel client", "Envoyer le devis", "Relance", "Préparer démo", "Administratif", "Autre"];

const TYPE_ICON: Record<string, string> = {
  "Rappel client": "📞",
  "Envoyer le devis": "📄",
  Relance: "🔔",
  "Préparer démo": "🛠",
  Administratif: "📋",
  Autre: "•",
};

type Group = { id: string; label: string; tasks: TaskRow[]; defaultOpen: boolean; tone?: "red" | "amber" };

/**
 * Tâches rangées par échéance. Les relances automatiques du pipe (oppos vieillissantes, closings à requalifier…)
 * sont isolées dans leur propre bloc replié pour ne pas noyer les tâches du jour.
 */
export function TaskList({ tasks, today }: { tasks: TaskRow[]; today: string }) {
  const [openTask, setOpenTask] = useState<TaskRow | null>(null);
  const byDue = (a: TaskRow, b: TaskRow) => (a.due ?? "9999-99-99").localeCompare(b.due ?? "9999-99-99");
  const manual = tasks.filter((t) => !t.auto).sort(byDue);
  const auto = tasks.filter((t) => t.auto).sort(byDue);
  const weekEnd = addDaysISO(today, 7);

  const groups: Group[] = [
    { id: "late", label: "En retard", tone: "red", defaultOpen: true, tasks: manual.filter((t) => t.due && t.due < today) },
    { id: "today", label: "Aujourd'hui", tone: "amber", defaultOpen: true, tasks: manual.filter((t) => t.due === today) },
    { id: "week", label: "Cette semaine", defaultOpen: true, tasks: manual.filter((t) => t.due && t.due > today && t.due <= weekEnd) },
    { id: "later", label: "Plus tard", defaultOpen: false, tasks: manual.filter((t) => t.due && t.due > weekEnd) },
    { id: "none", label: "Sans échéance", defaultOpen: false, tasks: manual.filter((t) => !t.due) },
    { id: "auto", label: "⚙ Relances automatiques du pipe", defaultOpen: false, tasks: auto },
  ];

  if (!tasks.length) {
    return (
      <div className="text-[12px] text-[var(--muted)]">
        Aucune tâche en cours. Ajoutez-en une avec ＋ Tâche, ou laissez les règles de pipe vous en proposer.
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {groups
        .filter((g) => g.tasks.length)
        .map((g) => (
          <GroupBlock key={g.id} g={g} today={today} onOpen={setOpenTask} />
        ))}
      {openTask && <TaskDrawer key={openTask.id} task={openTask} onClose={() => setOpenTask(null)} />}
    </div>
  );
}

function GroupBlock({ g, today, onOpen }: { g: Group; today: string; onOpen: (t: TaskRow) => void }) {
  const [open, setOpen] = useState(g.defaultOpen);
  const color = g.tone === "red" ? "var(--red)" : g.tone === "amber" ? "var(--amber)" : "var(--muted)";
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} className="mb-1.5 flex w-full items-center gap-1.5 text-left text-[11px] font-bold uppercase tracking-wide" style={{ color }}>
        <span className="w-3">{open ? "▾" : "▸"}</span>
        {g.label}
        <span className="rounded-full px-1.5 py-0.5 text-[10px]" style={{ background: "#F0F3EF", color: "var(--muted)" }}>
          {g.tasks.length}
        </span>
      </button>
      {open && (
        <div className="space-y-2">
          {g.tasks.map((t) => (
            <TaskCard key={t.id} task={t} today={today} onOpen={() => onOpen(t)} />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskCard({ task: t, today, onOpen }: { task: TaskRow; today: string; onOpen: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const over = !!t.due && t.due < today;
  const isToday = t.due === today;
  const icon = t.auto ? "⚙" : TYPE_ICON[t.type ?? "Autre"] ?? "•";
  const client = t.opportunities?.entities?.name ?? t.opportunities?.name;

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      const r = await fn();
      setError(r.ok ? null : (r.error ?? "Échec de l'action"));
    });

  return (
    <div
      className="rounded-lg border p-2.5"
      style={{ borderColor: over ? "var(--red)" : "var(--line)", background: over ? "#FBF1EF" : "#fff", opacity: pending ? 0.6 : 1 }}
    >
      <div className="flex gap-2.5">
        <span className="text-[15px]">{icon}</span>
        <div className="min-w-0 flex-1 cursor-pointer" onClick={onOpen} title="Ouvrir la tâche">
          <div className="text-[12.5px] font-semibold hover:underline">{t.title}</div>
          {t.note && <div className="line-clamp-2 text-[11px] text-[var(--muted)]">{t.note}</div>}
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="text-[10.5px] font-semibold" style={{ color: over ? "var(--red)" : isToday ? "var(--amber)" : "var(--muted)" }}>
              {t.due ? (over ? "⏰ " : isToday ? "📅 " : "") + fdate(t.due) : "sans échéance"}
            </span>
            {t.auto ? <Tag>auto</Tag> : t.type && <Tag>{t.type}</Tag>}
            {client && <Tag>{client}</Tag>}
          </div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button disabled={pending} onClick={() => run(() => markTaskDone(t.id))} className="btn px-2.5 py-1 text-[11px]">
          ✓ Fait
        </button>
        <button disabled={pending} onClick={() => run(() => snoozeTask(t.id, 1))} className="btn px-2.5 py-1 text-[11px]">
          +1j
        </button>
        <button disabled={pending} onClick={() => run(() => snoozeTask(t.id, 7))} className="btn px-2.5 py-1 text-[11px]">
          +7j
        </button>
        <button onClick={onOpen} className="btn px-2.5 py-1 text-[11px]">
          Modifier
        </button>
      </div>
      {error && <div className="mt-1.5 text-[11px] font-semibold text-[var(--red)]">{error}</div>}
    </div>
  );
}

function TaskDrawer({ task, onClose }: { task: TaskRow; onClose: () => void }) {
  const [title, setTitle] = useState(task.title);
  const [type, setType] = useState(task.type ?? "Autre");
  const [due, setDue] = useState(task.due ?? "");
  const [note, setNote] = useState(task.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const client = task.opportunities?.entities?.name ?? task.opportunities?.name;

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Échec de l'action");
      else onClose();
    });

  return (
    <>
      <div className="fixed inset-0 z-[200]" style={{ background: "rgba(14,20,17,.35)" }} onClick={onClose} />
      <div className="fixed right-0 top-0 z-[201] flex h-full w-[400px] max-w-[92vw] flex-col overflow-y-auto bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="relative border-b p-5" style={{ borderColor: "var(--line)" }}>
          <button onClick={onClose} className="absolute right-5 top-5 text-lg">
            ✕
          </button>
          <h2 className="font-display text-lg font-semibold">Tâche</h2>
          <div className="text-[11.5px] text-[var(--muted)]">
            {task.auto ? "Générée automatiquement par une règle du pipe" : "Créée manuellement"}
            {client ? ` · ${client}` : ""}
          </div>
        </div>
        <div className="flex-1 space-y-3 p-5">
          <label className="flex flex-col gap-1 text-xs font-semibold">
            Titre
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs font-semibold">
              Type
              <select value={type} onChange={(e) => setType(e.target.value)} className="input">
                {[...new Set([...TASK_TYPES, type])].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold">
              Échéance
              <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="input" />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-xs font-semibold">
            Détails
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={6} className="input" placeholder="Contexte, prochaine action, lien…" />
          </label>
          {error && <div className="text-[12.5px] font-semibold text-[var(--red)]">{error}</div>}
        </div>
        <div className="flex items-center gap-2 border-t p-4" style={{ borderColor: "var(--line)" }}>
          <button disabled={pending} onClick={() => run(() => markTaskDone(task.id))} className="btn" style={{ color: "var(--pine)", borderColor: "var(--pine)" }}>
            ✓ Fait
          </button>
          <button
            disabled={pending}
            onClick={() => {
              if (window.confirm("Abandonner cette tâche ? Elle disparaîtra de la liste.")) run(() => dismissTask(task.id));
            }}
            className="btn"
            style={{ color: "var(--red)" }}
          >
            Abandonner
          </button>
          <button disabled={pending} onClick={() => run(() => updateTask(task.id, { title, type, due: due || null, note }))} className="btn-primary ml-auto">
            Enregistrer
          </button>
        </div>
      </div>
    </>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "#F0F3EF", color: "var(--muted)" }}>
      {children}
    </span>
  );
}
