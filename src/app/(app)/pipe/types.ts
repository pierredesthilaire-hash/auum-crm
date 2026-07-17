export type OppRow = {
  id: string;
  name: string;
  stage: string;
  machines: number;
  amount: number;
  prob: number;
  close_date: string | null;
  install_date: string | null;
  notes: string | null;
  dyn_id: string | null;
  stage_orig: string | null;
  created_at: string;
  entity_id: string;
  ae_id: string;
  entities: { name: string } | null;
  profiles: { full_name: string } | null;
};

export type AeOption = { id: string; full_name: string };

export type CurrentUser = { id: string; fullName: string; isDirection: boolean };
