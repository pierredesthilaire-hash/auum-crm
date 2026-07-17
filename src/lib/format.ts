export function keur(n: number): string {
  if (Math.abs(n) >= 1e6) {
    return (n / 1e6).toLocaleString("fr-FR", { maximumFractionDigits: 2 }) + " M€";
  }
  return Math.round(n / 1000).toLocaleString("fr-FR") + " k€";
}

export function num(n: number): string {
  return Number(n || 0).toLocaleString("fr-FR", { maximumFractionDigits: 1 });
}

export function fdate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export const AE_PALETTE = [
  "#3E6FA8",
  "#149E7E",
  "#C98A1B",
  "#7B5EA7",
  "#C24E3A",
  "#5B8266",
  "#8A6D3B",
];

export function aeColor(name: string, allAeNames: string[]): string {
  const idx = allAeNames.indexOf(name);
  return AE_PALETTE[(idx < 0 ? 0 : idx) % AE_PALETTE.length];
}
