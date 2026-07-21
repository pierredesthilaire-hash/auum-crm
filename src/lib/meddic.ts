// Qualification MEDDIC obligatoire sur les opportunités de plus de MEDDIC_MIN_MACHINES machines.
export const MEDDIC_MIN_MACHINES = 5;

export const MEDDIC_FIELDS = [
  { key: "metrics", label: "Metrics", hint: "Gain / impact business mesurable pour le client" },
  { key: "economic_buyer", label: "Economic Buyer", hint: "Qui signe le budget ?" },
  { key: "decision_criteria", label: "Decision Criteria", hint: "Sur quels critères le client tranche" },
  { key: "decision_process", label: "Decision Process", hint: "Étapes / validations internes côté client" },
  { key: "pain", label: "Identify Pain", hint: "Problème / douleur qui motive l'achat" },
  { key: "champion", label: "Champion", hint: "Sponsor interne qui pousse le projet" },
] as const;

export type MeddicKey = (typeof MEDDIC_FIELDS)[number]["key"];
export type MeddicFields = Record<MeddicKey, string | null | undefined>;

export function isMeddicComplete(f: Partial<MeddicFields>): boolean {
  return MEDDIC_FIELDS.every((m) => (f[m.key] ?? "").trim().length > 0);
}

export function meddicRequired(machines: number): boolean {
  return machines > MEDDIC_MIN_MACHINES;
}
