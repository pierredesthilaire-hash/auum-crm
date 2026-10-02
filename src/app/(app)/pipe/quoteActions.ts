"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DURATIONS, ISSUERS, QUOTE_STATUSES, computeTotals, eur, type QuoteLine } from "@/lib/quotes";

export type QuoteInput = {
  issuer: string;
  duration_months: number;
  vat_rate: number;
  valid_until: string | null;
  status: string;
  notes: string | null;
  lines: QuoteLine[];
};

function validate(input: QuoteInput): string | null {
  if (!(DURATIONS as readonly number[]).includes(input.duration_months)) return "Durée invalide.";
  if (!(QUOTE_STATUSES as readonly string[]).includes(input.status)) return "Statut invalide.";
  if (!(input.issuer in ISSUERS)) return "Entité émettrice invalide.";
  if (!(input.vat_rate >= 0 && input.vat_rate <= 100)) return "TVA invalide.";
  if (!input.lines.length) return "Ajoutez au moins une ligne au devis.";
  for (const l of input.lines) {
    if (!l.label.trim()) return "Chaque ligne doit avoir un libellé.";
    if (!(l.qty > 0) || !(l.unit_price >= 0)) return `Quantité ou prix invalide sur « ${l.label} ».`;
    if (l.discount !== undefined && !(l.discount >= 0 && l.discount <= 100)) return `Remise invalide sur « ${l.label} ».`;
    if (l.period !== "monthly" && l.period !== "once") return "Périodicité invalide.";
  }
  return null;
}

export async function saveQuote(
  oppId: string,
  quoteId: string | null,
  input: QuoteInput,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const bad = validate(input);
  if (bad) return { ok: false, error: bad };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié" };

  const { data: opp } = await supabase.from("opportunities").select("ae_id").eq("id", oppId).single();
  if (!opp) return { ok: false, error: "Opportunité introuvable" };

  const payload = {
    issuer: input.issuer,
    duration_months: input.duration_months,
    vat_rate: input.vat_rate,
    valid_until: input.valid_until,
    status: input.status,
    notes: input.notes?.trim() || null,
    lines: input.lines.map((l) => ({ ...l, label: l.label.trim() })),
  };
  const totals = computeTotals(input.lines, input.duration_months, input.vat_rate);

  let id = quoteId;
  if (quoteId) {
    const { error } = await supabase.from("quotes").update(payload).eq("id", quoteId);
    if (error) return { ok: false, error: error.message };
  } else {
    const { data, error } = await supabase
      .from("quotes")
      .insert({ ...payload, opp_id: oppId, ae_id: opp.ae_id })
      .select("id, number")
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Échec de création du devis" };
    id = data.id;
    await supabase.from("audit_log").insert({
      user_id: user.id,
      opp_id: oppId,
      type: "quote",
      detail: `Devis ${data.number} créé · ${input.duration_months} mois · ${eur(totals.monthlyHT)} HT/mois`,
    });
  }
  revalidatePath("/pipe");
  return { ok: true, id: id ?? undefined };
}

export async function deleteQuote(quoteId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("quotes").delete().eq("id", quoteId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/pipe");
  return { ok: true };
}
