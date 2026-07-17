export type AeOption = { id: string; full_name: string };

export type OppKpi = {
  id: string;
  amount: number;
  prob: number;
  machines: number;
  close_date: string | null;
};

export type MeetingRow = {
  id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  title: string | null;
  with_who: string | null;
  place: string | null;
  opp_id: string | null;
};

export type TaskRow = {
  id: string;
  title: string;
  type: string | null;
  due: string | null;
  note: string | null;
  auto: boolean;
  rule: string | null;
  opp_id: string | null;
  opportunities: { name: string; entities: { name: string } | null } | null;
};
