export type AeOption = { id: string; full_name: string };

export type CockpitOpp = {
  id: string;
  name: string;
  stage: string;
  machines: number;
  amount: number;
  prob: number;
  source: string | null;
  close_date: string | null;
  created_at: string;
  entities: { name: string } | null;
  profiles: { full_name: string } | null;
};

export type AuditRow = {
  id: number;
  at: string;
  type: string;
  detail: string | null;
  dir: string | null;
  delta_machines: number | null;
  delta_amount: number | null;
  profiles: { full_name: string } | null;
  opportunities: { name: string; entities: { name: string } | null } | null;
};
