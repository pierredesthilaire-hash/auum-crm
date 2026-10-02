export type OppContact = {
  id: string;
  full_name: string;
  role: string | null;
  persona: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
};

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
  meddic_metrics: string | null;
  meddic_economic_buyer: string | null;
  meddic_decision_criteria: string | null;
  meddic_decision_process: string | null;
  meddic_pain: string | null;
  meddic_champion: string | null;
  dyn_id: string | null;
  stage_orig: string | null;
  created_at: string;
  entity_id: string;
  ae_id: string;
  entities: { name: string } | null;
  profiles: { full_name: string } | null;
  opportunity_contacts: { contacts: OppContact | null }[];
};

export type AeOption = { id: string; full_name: string };

export type CurrentUser = { id: string; fullName: string; isDirection: boolean };
