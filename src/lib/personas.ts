export const PERSONAS = [
  "Achat",
  "RSE",
  "QHSE",
  "Direction de Site",
  "Environnement de Travail",
] as const;

export type Persona = (typeof PERSONAS)[number];

export const isPersona = (v: unknown): v is Persona =>
  typeof v === "string" && (PERSONAS as readonly string[]).includes(v);
