import { STAGES, stageOf } from "@/lib/stages";
import { isAging, type Benchmarks } from "@/lib/lifecycle";

export type WAudit = {
  at: string;
  type: string;
  detail: string | null;
  dir: string | null;
  from_stage: string | null;
  to_stage: string | null;
  delta_machines: number | null;
  delta_amount: number | null;
  opp_id: string | null;
  opportunities: { name: string; ae_id?: string; entities: { name: string } | null } | null;
};
export type WTask = { owner_id: string; status: string; due: string | null; done_on: string | null; created_at: string; auto: boolean; title: string };
export type WMeeting = { ae_id: string | null; date: string; title: string | null; with_who: string | null };
export type WQuote = { ae_id: string; created_at: string; number: string; status: string; opportunities: { name: string; entities: { name: string } | null } | null };
export type WOpp = {
  id: string; name: string; stage: string; machines: number; amount: number; source: string | null;
  close_date: string | null; created_at: string; ae_id: string; entities: { name: string } | null;
};

export type WeeklyData = { audit: WAudit[]; tasks: WTask[]; meetings: WMeeting[]; quotes: WQuote[]; opps: WOpp[] };

/** Date civile Europe/Paris d'un horodatage. */
export function parisDate(iso: string): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(new Date(iso));
}

const addDays = (d: string, n: number) => {
  const x = new Date(d + "T12:00:00Z");
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

/** Lundi de la semaine contenant `d` (YYYY-MM-DD). */
export function weekStartOf(d: string): string {
  const dow = (new Date(d + "T12:00:00Z").getUTCDay() + 6) % 7; // lundi = 0
  return addDays(d, -dow);
}
export const weekEndOf = (start: string) => addDays(start, 6);
export const shiftWeek = (start: string, n: number) => addDays(start, 7 * n);

export function isoWeekNumber(start: string): number {
  const d = new Date(start + "T12:00:00Z");
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d.getTime() - firstThu.getTime()) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
}

export type Moved = { opp: string; client: string; from: string; to: string; dir: string | null; comment: string };
export type Exit = { opp: string; client: string; machines: number; amount: number; comment: string };

export type WeekStats = {
  created: { opp: string; client: string; machines: number }[];
  moves: Moved[];
  up: number;
  down: number;
  won: Exit[];
  lost: Exit[];
  wonMachines: number;
  lostMachines: number;
  transitions: { from: string; to: string; n: number }[];
  quotes: WQuote[];
  meetings: WMeeting[];
  tasksDone: number;
  tasksCreated: number;
};

const label = (id: string | null) => (id ? stageOf(id)?.label ?? id : "?");
const afterDash = (detail: string | null) => (detail?.includes(" · ") ? detail.split(" · ").slice(1).join(" · ") : "");

/** Statistiques d'une semaine (lundi → dimanche) pour un AE, ou pour toute l'équipe si aeId est null. */
export function weekStats(data: WeeklyData, start: string, aeId: string | null): WeekStats {
  const end = weekEndOf(start);
  const inWeek = (d: string) => d >= start && d <= end;
  const mine = (ae: string | null | undefined) => !aeId || ae === aeId;

  const rows = data.audit.filter((r) => inWeek(parisDate(r.at)) && mine(r.opportunities?.ae_id));
  const name = (r: WAudit) => r.opportunities?.name ?? "—";
  const client = (r: WAudit) => r.opportunities?.entities?.name ?? "";

  const moves = rows
    .filter((r) => r.type === "stage_change")
    .map((r) => {
      const [a, b] = (r.detail ?? "").split(" · ")[0].split(" → ");
      return { opp: name(r), client: client(r), from: r.from_stage ? label(r.from_stage) : a?.trim() || "?", to: r.to_stage ? label(r.to_stage) : b?.trim() || "?", dir: r.dir, comment: afterDash(r.detail) };
    });
  const exit = (type: string): Exit[] =>
    rows.filter((r) => r.type === type).map((r) => ({ opp: name(r), client: client(r), machines: r.delta_machines ?? 0, amount: r.delta_amount ?? 0, comment: afterDash(r.detail) }));
  const won = exit("opp_won");
  const lost = exit("opp_lost");

  const counts = new Map<string, number>();
  for (const m of moves) counts.set(`${m.from}→${m.to}`, (counts.get(`${m.from}→${m.to}`) ?? 0) + 1);
  const order: string[] = STAGES.map((s) => s.label);
  const transitions = [...counts].map(([k, n]) => {
    const [from, to] = k.split("→");
    return { from, to, n };
  }).sort((a, b) => order.indexOf(a.from) - order.indexOf(b.from) || order.indexOf(a.to) - order.indexOf(b.to));

  return {
    created: rows.filter((r) => r.type === "opp_created").map((r) => ({ opp: name(r), client: client(r), machines: r.delta_machines ?? 0 })),
    moves,
    up: moves.filter((m) => m.dir === "up").length,
    down: moves.filter((m) => m.dir === "down").length,
    won,
    lost,
    wonMachines: won.reduce((s, e) => s + e.machines, 0),
    lostMachines: lost.reduce((s, e) => s + e.machines, 0),
    transitions,
    quotes: data.quotes.filter((q) => inWeek(parisDate(q.created_at)) && mine(q.ae_id)),
    meetings: data.meetings.filter((m) => inWeek(m.date) && mine(m.ae_id)),
    tasksDone: data.tasks.filter((t) => t.status === "done" && t.done_on && inWeek(t.done_on) && mine(t.owner_id)).length,
    tasksCreated: data.tasks.filter((t) => !t.auto && inWeek(parisDate(t.created_at)) && mine(t.owner_id)).length,
  };
}

export type Summary = { title: string; sections: { heading: string; lines: string[] }[] };

const plural = (n: number, s: string, p = s + "s") => `${n} ${n > 1 ? p : s}`;
const k = (n: number) => `${Math.round(n / 1000).toLocaleString("fr-FR")} k€`;
const fd = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });

/** Résumé d'une semaine pour préparer le point individuel avec un AE. */
export function buildSummary(
  data: WeeklyData,
  start: string,
  ae: { id: string; full_name: string },
  today: string,
  benchmarks: Benchmarks,
): Summary {
  const s = weekStats(data, start, ae.id);
  const prev = weekStats(data, shiftWeek(start, -1), ae.id);
  const first = ae.full_name.split(" ")[0];
  const open = data.opps.filter((o) => o.ae_id === ae.id);
  const late = open.filter((o) => o.stage === "nego" || o.stage === "signature");
  const lateNoDate = late.filter((o) => !o.close_date);
  const latePast = late.filter((o) => o.close_date && o.close_date < today);
  const aging = open.filter((o) => isAging(o, benchmarks, today)).sort((a, b) => b.amount - a.amount);
  const overdue = data.tasks.filter((t) => t.owner_id === ae.id && t.status === "open" && !t.auto && t.due && t.due < today);
  const cl = (o: { name: string; entities: { name: string } | null }) => o.entities?.name ?? o.name;

  const activity: string[] = [];
  activity.push(`${plural(s.created.length, "opportunité créée", "opportunités créées")} (semaine précédente : ${prev.created.length}).`);
  if (s.moves.length) {
    activity.push(`${plural(s.moves.length, "changement d'étape")} : ${s.up} en avancée, ${s.down} en recul (semaine précédente : ${prev.moves.length}).`);
    for (const m of s.moves.slice(0, 8)) activity.push(`• ${m.client || m.opp} : ${m.from} → ${m.to}${m.comment ? ` (${m.comment})` : ""}`);
  } else activity.push("Aucun changement d'étape enregistré.");
  if (s.won.length) activity.push(`Signées : ${s.won.map((e) => `${e.client || e.opp} (${e.machines} machine${e.machines > 1 ? "s" : ""})`).join(", ")}.`);
  if (s.lost.length) activity.push(`Perdues : ${s.lost.map((e) => `${e.client || e.opp} (${e.machines} m.)${e.comment ? " — " + e.comment : ""}`).join(", ")}.`);
  activity.push(`${plural(s.meetings.length, "RDV")} au calendrier${s.meetings.length === 0 ? " (ou Outlook non synchronisé)" : ""}, ${plural(s.quotes.length, "devis")} émis, ${plural(s.tasksDone, "tâche")} terminée${s.tasksDone > 1 ? "s" : ""}.`);

  const pipe: string[] = [
    `${plural(open.length, "opportunité ouverte", "opportunités ouvertes")}, ${open.reduce((x, o) => x + o.machines, 0)} machines, ${k(open.reduce((x, o) => x + o.amount, 0))}.`,
    `En Négociation / Validation : ${late.length} deal${late.length > 1 ? "s" : ""}, ${late.reduce((x, o) => x + o.machines, 0)} machines, ${k(late.reduce((x, o) => x + o.amount, 0))}.`,
  ];

  const attention: string[] = [];
  if (latePast.length) attention.push(`${plural(latePast.length, "deal tardif")} avec une date de closing dépassée : ${latePast.slice(0, 5).map((o) => `${cl(o)} (${fd(o.close_date!)})`).join(", ")}.`);
  if (lateNoDate.length) attention.push(`${plural(lateNoDate.length, "deal tardif")} sans date de closing : ${lateNoDate.slice(0, 5).map(cl).join(", ")}.`);
  if (aging.length) attention.push(`${plural(aging.length, "opportunité vieillissante", "opportunités vieillissantes")} (trop anciennes pour leur cycle) : ${aging.slice(0, 5).map(cl).join(", ")}.`);
  if (overdue.length) attention.push(`${plural(overdue.length, "tâche")} manuelle${overdue.length > 1 ? "s" : ""} en retard.`);
  if (!attention.length) attention.push("Rien d'anormal détecté sur les règles de suivi.");

  const questions: string[] = [];
  for (const o of latePast.slice(0, 3)) questions.push(`${cl(o)} : quelle est la prochaine étape concrète, et quelle nouvelle date de closing ?`);
  for (const o of aging.slice(0, 2)) questions.push(`${cl(o)} (${o.machines} machines) : on relance, on requalifie ou on clôt ?`);
  for (const m of s.lost.slice(0, 2)) questions.push(`${m.client || m.opp} perdue : qu'en retenir, et reste-t-il un angle de rebond ?`);
  if (s.created.length === 0) questions.push("Aucune nouvelle opportunité cette semaine : quel plan de prospection pour les 7 prochains jours ?");
  if (s.meetings.length === 0) questions.push("Aucun RDV visible : quels rendez-vous sont prévus la semaine prochaine ?");
  if (late.length) questions.push(`Sur les ${late.length} deals tardifs, lesquels signent ce mois-ci et qu'est-ce qui pourrait les bloquer ?`);
  if (!questions.length) questions.push("Quels sont ses 3 priorités pour la semaine à venir ?");

  return {
    title: `${first} — semaine ${isoWeekNumber(start)} (${fd(start)} au ${fd(weekEndOf(start))})`,
    sections: [
      { heading: "Activité de la semaine", lines: activity },
      { heading: "Situation du pipe à ce jour", lines: pipe },
      { heading: "Points d'attention", lines: attention },
      { heading: "Questions pour le point individuel", lines: questions },
    ],
  };
}

export function summaryToText(s: Summary): string {
  return [s.title, ...s.sections.map((x) => `\n${x.heading}\n${x.lines.map((l) => (l.startsWith("•") ? l : `- ${l}`)).join("\n")}`)].join("\n");
}
