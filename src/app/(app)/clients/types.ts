export type EntityRow = {
  id: string;
  name: string;
  group_id: string | null;
  siret: string | null;
  sector: string | null;
  headcount: number | null;
  parc: number;
  parc_note: string | null;
  owner_id: string | null;
  groups: { id: string; name: string } | null;
  profiles: { full_name: string } | null;
};

export type ContactRow = {
  id: string;
  entity_id: string;
  full_name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
};

export type EntityOpp = {
  id: string;
  entity_id: string;
  name: string;
  stage: string;
  machines: number;
  amount: number;
  close_date: string | null;
  ae_id: string;
  profiles: { full_name: string } | null;
};

export type NewsRow = {
  entity_id: string;
  date: string;
  title: string;
  signal: string | null;
  suggestion: string | null;
};

export type GroupOption = { id: string; name: string };
export type AeOption = { id: string; full_name: string };
export type CurrentUser = { id: string; fullName: string; isDirection: boolean };
