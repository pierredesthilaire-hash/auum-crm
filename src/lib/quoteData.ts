import type { SupabaseClient } from "@supabase/supabase-js";
import type { QuoteRow } from "@/lib/quotes";

export type QuoteFull = QuoteRow & {
  opportunities: {
    name: string;
    entities: { name: string } | null;
    profiles: { full_name: string } | null;
    opportunity_contacts: { contacts: { full_name: string; role: string | null; email: string | null } | null }[];
  } | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadQuote(supabase: SupabaseClient<any>, id: string): Promise<QuoteFull | null> {
  const { data } = await supabase
    .from("quotes")
    .select(
      "id, number, issuer, created_at, duration_months, vat_rate, valid_until, status, notes, lines, opportunities(name, entities(name), profiles(full_name), opportunity_contacts(contacts(full_name, role, email)))",
    )
    .eq("id", id)
    .maybeSingle<QuoteFull>();
  return data ?? null;
}
