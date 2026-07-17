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

export function isAging(
  opp: { source: string | null; created_at: string },
  benchmarks: Benchmarks,
  today: string,
): boolean {
  const key = srcKey(opp.source);
  const bench = (key && benchmarks.sources[key]) || benchmarks.global;
  const ageDays = Math.floor(
    (new Date(today + "T00:00:00").getTime() - new Date(opp.created_at).setHours(0, 0, 0, 0)) /
      86_400_000,
  );
  const cycle = bench.cycle || benchmarks.global.cycle;
  const ratio = cycle ? ageDays / cycle : 0;
  return ratio > benchmarks.alertRatio;
}
