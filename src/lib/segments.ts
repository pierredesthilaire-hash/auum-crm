export type SegmentId = "smb" | "grand" | "cle";

export type SegConfig = { smb: number; grand: number };

export const SEG_LABEL: Record<SegmentId, string> = {
  smb: "SMB",
  grand: "Grand Compte",
  cle: "Compte Clé",
};

export const SEG_COLOR: Record<SegmentId, string> = {
  smb: "#3E6FA8",
  grand: "#C98A1B",
  cle: "#0E3F30",
};

export function segmentOf(headcount: number | null, cfg: SegConfig): SegmentId | null {
  if (headcount == null) return null;
  if (headcount < cfg.smb) return "smb";
  if (headcount <= cfg.grand) return "grand";
  return "cle";
}

export function segDesc(seg: SegmentId, cfg: SegConfig): string {
  if (seg === "smb") return `< ${cfg.smb} pers.`;
  if (seg === "grand") return `${cfg.smb}–${cfg.grand} pers.`;
  return `> ${cfg.grand} pers.`;
}
