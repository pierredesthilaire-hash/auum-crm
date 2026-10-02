export const STAGES = [
  { id: "decouverte", label: "R1", color: "#7C8B9D" },
  { id: "r2", label: "R2", color: "#3E6FA8" },
  { id: "demo", label: "Test", color: "#149E7E" },
  { id: "nego", label: "Négociation", color: "#C98A1B" },
  { id: "signature", label: "Validation", color: "#0E3F30" },
] as const;

export type StageId = (typeof STAGES)[number]["id"];

export const stageOf = (id: string) => STAGES.find((s) => s.id === id);

export const SOURCES = [
  "Outbound/Prospection",
  "Marketing",
  "Upsell",
  "Salon",
  "Renouvellement",
  "Partenariat",
  "Autre",
];

export const PROB_OPTIONS = [20, 40, 50, 60, 80, 90];
