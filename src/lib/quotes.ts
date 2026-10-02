export type Period = "monthly" | "once";

export type QuoteLine = {
  code: string;
  label: string;
  qty: number;
  unit_price: number; // € HT
  discount?: number; // remise en % sur la ligne (0-100)
  period: Period; // monthly = par mois pendant la durée ; once = facturé une fois
};

export const DURATIONS = [24, 36, 48] as const;
export type Duration = (typeof DURATIONS)[number];

/** Loyer mensuel HT par machine selon la durée d'engagement. */
export const RENT_BY_DURATION: Record<Duration, number> = { 24: 149, 36: 139, 48: 129 };
export const INCLUDED_GLASSES = 60;

export const QUOTE_STATUSES = ["brouillon", "envoyé", "accepté", "refusé"] as const;

export type Product = { code: string; label: string; period: Period; price: number };

/**
 * Catalogue. Seul le loyer de la machine est fixé par la grille ci-dessus ;
 * les autres prix sont à 0 tant qu'ils n'ont pas été communiqués : l'AE les saisit sur le devis.
 */
export const PRODUCTS: Product[] = [
  { code: "machine", label: "Location machine Auum-S", period: "monthly", price: 0 },
  { code: "maintenance", label: "Entretien et maintenance", period: "monthly", price: 0 },
  { code: "livraison", label: "Livraison et installation", period: "once", price: 400 },
  { code: "verre", label: "Verres en verre", period: "once", price: 6.5 },
  { code: "plastique_noir", label: "Verres en plastique noir", period: "once", price: 4 },
  { code: "plastique_beige", label: "Verres en plastique beige", period: "once", price: 4 },
  { code: "plastique_transparent", label: "Verres en plastique transparent", period: "once", price: 4 },
  { code: "personnalisation", label: "Personnalisation des verres", period: "once", price: 0 },
];

export function machineLine(qty: number, duration: Duration): QuoteLine {
  return {
    code: "machine",
    label: `Location machine Auum-S — ${INCLUDED_GLASSES} verres inclus par machine`,
    qty,
    unit_price: RENT_BY_DURATION[duration],
    period: "monthly",
  };
}

export function lineFromProduct(p: Product): QuoteLine {
  return { code: p.code, label: p.label, qty: 1, unit_price: p.price, period: p.period };
}

export const lineTotal = (l: QuoteLine) => l.qty * l.unit_price * (1 - (l.discount ?? 0) / 100);

export function computeTotals(lines: QuoteLine[], duration: number, vatRate: number) {
  const sum = (period: Period) =>
    lines.filter((l) => l.period === period).reduce((s, l) => s + lineTotal(l), 0);
  const monthlyHT = sum("monthly");
  const onceHT = sum("once");
  const contractHT = monthlyHT * duration + onceHT;
  const k = 1 + vatRate / 100;
  return {
    monthlyHT,
    monthlyTTC: monthlyHT * k,
    onceHT,
    onceTTC: onceHT * k,
    contractHT,
    contractTTC: contractHT * k,
  };
}

export const eur = (n: number) =>
  n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });

export const ISSUERS = {
  auum: {
    name: "AUUM",
    legal: "Société par actions simplifiée au capital de 41 770 €",
    address: "107 avenue de la République, 92320 Châtillon",
    ids: "SIREN 845 300 128 · RCS Nanterre · TVA FR05845300128",
  },
  auum_finance: {
    name: "AUUM FINANCE",
    legal: "Société par actions simplifiée au capital de 10 000 €",
    address: "70 rue de Villiers, 92300 Levallois-Perret",
    ids: "SIREN 983 442 591 · RCS Nanterre · TVA FR35983442591",
  },
} as const;
export type IssuerKey = keyof typeof ISSUERS;

export type QuoteRow = {
  issuer: IssuerKey;
  id: string;
  number: string;
  created_at: string;
  duration_months: number;
  vat_rate: number;
  valid_until: string | null;
  status: string;
  notes: string | null;
  lines: QuoteLine[];
};
