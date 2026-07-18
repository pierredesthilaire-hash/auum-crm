export type AeOption = { id: string; full_name: string };
export type CurrentUser = { id: string; fullName: string; isDirection: boolean };

export type ProspectRow = {
  id: string;
  company: string;
  contact: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  city: string | null;
  sector: string | null;
  headcount: number | null;
  ae_id: string | null;
  status: string;
  source: string | null;
  opp_id: string | null;
  created_at: string;
  profiles: { full_name: string } | null;
  touches: { id: string }[];
};
