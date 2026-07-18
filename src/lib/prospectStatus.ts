export const PSTATUS = [
  { id: "a_contacter", label: "À contacter", color: "#7C8B9D" },
  { id: "contacte", label: "Contacté", color: "#3E6FA8" },
  { id: "r1_planifie", label: "R1 planifié", color: "#7B5EA7" },
  { id: "r1_realise", label: "R1 réalisé", color: "#149E7E" },
  { id: "converti", label: "Converti (oppo)", color: "#0E3F30" },
  { id: "sans_suite", label: "Sans suite", color: "#A88A80" },
] as const;

export type ProspectStatusId = (typeof PSTATUS)[number]["id"];

export const pstatOf = (id: string) => PSTATUS.find((s) => s.id === id) ?? PSTATUS[0];
