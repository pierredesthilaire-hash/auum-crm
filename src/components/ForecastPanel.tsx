import { STAGES } from "@/lib/stages";

export type ForecastOpp = { stage: string; machines: number; prob: number; close_date: string | null };

/** Étapes tardives dont on projette les signatures. */
const LATE_STAGES = ["nego", "signature"] as const;

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

type Bucket = { deals: number; machines: number; weighted: number };
const empty = (): Bucket => ({ deals: 0, machines: 0, weighted: 0 });

export function computeForecast(opps: ForecastOpp[], today: string) {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7)); // 1-12
  const q = Math.floor((month - 1) / 3);
  const inMonth = (d: string) => Number(d.slice(0, 4)) === year && Number(d.slice(5, 7)) === month;
  const inQuarter = (d: string) => Number(d.slice(0, 4)) === year && Math.floor((Number(d.slice(5, 7)) - 1) / 3) === q;

  const m = empty(), qt = empty(), late = empty(), noDate = empty(), later = empty();
  const add = (b: Bucket, o: ForecastOpp) => {
    b.deals += 1;
    b.machines += o.machines;
    b.weighted += (o.machines * o.prob) / 100;
  };
  for (const o of opps) {
    if (!(LATE_STAGES as readonly string[]).includes(o.stage)) continue;
    if (!o.close_date) add(noDate, o);
    else if (o.close_date < today) add(late, o);
    else {
      if (inMonth(o.close_date)) add(m, o);
      if (inQuarter(o.close_date)) add(qt, o);
      if (!inQuarter(o.close_date)) add(later, o);
    }
  }
  return { month: m, quarter: qt, late, noDate, later, monthLabel: MONTHS[month - 1], quarterLabel: `T${q + 1} ${year}` };
}

const fmt = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

function Card({ title, b, accent }: { title: string; b: Bucket; accent?: boolean }) {
  return (
    <div className="rounded-xl border bg-white p-3" style={{ borderColor: "var(--line)" }}>
      <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--muted)]">{title}</div>
      <div className="font-display mt-1 text-[22px] font-bold leading-none" style={{ color: accent ? "var(--teal)" : "var(--ink)" }}>
        {fmt(b.weighted)} <span className="text-[12px] font-semibold text-[var(--muted)]">machines pondérées</span>
      </div>
      <div className="mt-1 text-[11.5px] text-[var(--muted)]">
        {b.machines} machine(s) au total · {b.deals} deal(s)
      </div>
    </div>
  )
}

export function ForecastPanel({ opps, today }: { opps: ForecastOpp[]; today: string }) {
  const f = computeForecast(opps, today);
  const stageNames = LATE_STAGES.map((id) => STAGES.find((s) => s.id === id)?.label).join(" + ");

  return (
    <div className="mb-4">
      <div className="mb-2 text-xs font-semibold">
        Projection des signatures <span className="font-normal text-[var(--muted)]">— deals en {stageNames}, selon la date de fermeture estimée</span>
      </div>
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-5">
        <Card title={`Ce mois (${f.monthLabel})`} b={f.month} accent />
        <Card title={`Ce trimestre (${f.quarterLabel})`} b={f.quarter} accent />
        <Card title="Au-delà du trimestre" b={f.later} />
        <Card title="Date dépassée" b={f.late} />
        <Card title="Sans date de fermeture" b={f.noDate} />
      </div>
      <div className="mt-1 text-[10.5px] text-[var(--muted)]">
        Pondérées = machines × probabilité de l&apos;opportunité. Le trimestre inclut le mois en cours. Les deals à date dépassée ne sont comptés ni dans le mois ni dans le trimestre : mettez leur date à jour.
      </div>
    </div>
  );
}
