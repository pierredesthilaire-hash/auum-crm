export type Benchmarks = {
  global: { cycle: number; close: number };
  sources: Record<string, { cycle: number; close: number }>;
  alertRatio: number;
  floor: number;
};

export const DEFAULT_BENCHMARKS: Benchmarks = {
  global: { cycle: 70.4, close: 40 },
  sources: {
    Outbound: { cycle: 70.4, close: 29 },
    Marketing: { cycle: 74.5, close: 23 },
    Upsell: { cycle: 63.3, close: 61 },
    Renouvellement: { cycle: 68.2, close: 68 },
  },
  alertRatio: 1.5,
  floor: 0.5,
};

function srcKey(source: string | null): string | null {
  const s = (source ?? "").toLowerCase();
  if (s.includes("outbound") || s.includes("prospection") || s.includes("sdr")) return "Outbound";
  if (s.includes("marketing")) return "Marketing";
  if (s.includes("upsell")) return "Upsell";
  if (s.includes("renouvellement")) return "Renouvellement";
  return null;
}

function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA + "T00:00:00").getTime();
  const b = new Date(dateB + "T00:00:00").getTime();
  return Math.round((b - a) / 86_400_000);
}

export type LifecycleOpp = {
  source: string | null;
  created_at: string;
  prob: number;
  amount: number;
  machines: number;
};

export type Lifecycle = {
  key: string;
  age: number;
  cycle: number;
  ratio: number;
  fresh: number;
  probAdj: number;
  wAdj: number;
  mAdj: number;
  histClose: number;
  aging: boolean;
};

export function computeLifecycle(opp: LifecycleOpp, benchmarks: Benchmarks, today: string): Lifecycle {
  const key = srcKey(opp.source);
  const bench = (key && benchmarks.sources[key]) || benchmarks.global;
  const age = daysBetween(opp.created_at.slice(0, 10), today);
  const cycle = bench.cycle || benchmarks.global.cycle;
  const ratio = cycle ? age / cycle : 0;
  const fresh = ratio <= 1 ? 1 : ratio >= 2 ? benchmarks.floor : 1 - (ratio - 1) * (1 - benchmarks.floor);
  const probAdj = opp.prob * fresh;
  return {
    key: key ?? "Global",
    age,
    cycle,
    ratio,
    fresh,
    probAdj,
    wAdj: (opp.amount * probAdj) / 100,
    mAdj: (opp.machines * probAdj) / 100,
    histClose: bench.close,
    aging: ratio > benchmarks.alertRatio,
  };
}

export function isAging(
  opp: { source: string | null; created_at: string },
  benchmarks: Benchmarks,
  today: string,
): boolean {
  return computeLifecycle({ ...opp, prob: 0, amount: 0, machines: 0 }, benchmarks, today).aging;
}
