import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { INCLUDED_GLASSES, ISSUERS, computeTotals, eur, lineTotal } from "@/lib/quotes";
import { loadQuote } from "@/lib/quoteData";
import { fdate } from "@/lib/format";
import { PrintButton } from "./PrintButton";

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const q = await loadQuote(supabase, id);
  if (!q) notFound();

  const t = computeTotals(q.lines, q.duration_months, q.vat_rate);
  const contact = q.opportunities?.opportunity_contacts?.map((x) => x.contacts).find(Boolean) ?? null;
  const issuer = ISSUERS[q.issuer] ?? ISSUERS.auum;
  const hasDiscount = q.lines.some((l) => (l.discount ?? 0) > 0);
  const hasRent = q.lines.some((l) => l.code === "machine");

  return (
    <div className="min-h-screen bg-neutral-100 py-8 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[820px] justify-end gap-2 print:hidden">
        <a
          href={`/devis/${q.id}/pdf`}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
          style={{ background: "#149E7E" }}
        >
          ⬇ Télécharger le PDF
        </a>
        <PrintButton />
      </div>
      <div className="mx-auto max-w-[820px] bg-white p-10 text-[13px] text-neutral-900 shadow print:shadow-none">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[34px] font-bold leading-none tracking-tight" style={{ color: "#0E3F30" }}>
              auum<span style={{ color: "#149E7E" }}>.</span>
            </div>
            <div className="mt-2 text-[11.5px] leading-snug text-neutral-600">
              <b>{issuer.name}</b> — {issuer.legal}
              <br />
              {issuer.address}
              <br />
              {issuer.ids}
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold">Devis {q.number}</div>
            <div className="text-neutral-600">Émis le {new Date(q.created_at).toLocaleDateString("fr-FR")}</div>
            {q.valid_until && <div className="text-neutral-600">Valable jusqu&apos;au {fdate(q.valid_until)}</div>}
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-6">
          <div>
            <div className="text-[11px] font-semibold uppercase text-neutral-500">Client</div>
            <div className="text-base font-semibold">{q.opportunities?.entities?.name}</div>
            {contact && (
              <div className="text-neutral-700">
                À l&apos;attention de {contact.full_name}
                {contact.role ? `, ${contact.role}` : ""}
                {contact.email && <div>{contact.email}</div>}
              </div>
            )}
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase text-neutral-500">Votre interlocuteur Auum</div>
            <div className="font-semibold">{q.opportunities?.profiles?.full_name}</div>
          </div>
        </div>

        <div className="mt-6 text-neutral-700">
          Projet : <b>{q.opportunities?.name}</b> — engagement de <b>{q.duration_months} mois</b>.
        </div>

        <table className="mt-4 w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-neutral-800 text-left text-[11px] uppercase">
              <th className="py-2">Désignation</th>
              <th className="w-14 py-2 text-right">Qté</th>
              <th className="w-28 py-2 text-right">Prix unit. HT</th>
              {hasDiscount && <th className="w-16 py-2 text-right">Remise</th>}
              <th className="w-24 py-2">Facturation</th>
              <th className="w-28 py-2 text-right">Total HT</th>
            </tr>
          </thead>
          <tbody>
            {q.lines.map((l, i) => (
              <tr key={i} className="border-b border-neutral-200">
                <td className="py-2">{l.label}</td>
                <td className="py-2 text-right">{l.qty}</td>
                <td className="py-2 text-right">{eur(l.unit_price)}</td>
                {hasDiscount && <td className="py-2 text-right">{(l.discount ?? 0) > 0 ? `${l.discount} %` : ""}</td>}
                <td className="py-2">{l.period === "monthly" ? "Par mois" : "Une fois"}</td>
                <td className="py-2 text-right">{eur(lineTotal(l))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="ml-auto mt-5 w-[360px] space-y-1">
          <Row l="Mensualités HT (par mois)" v={eur(t.monthlyHT)} />
          <Row l={`Mensualités TTC (TVA ${q.vat_rate} %)`} v={eur(t.monthlyTTC)} />
          {t.onceHT > 0 && <Row l="Frais ponctuels HT" v={eur(t.onceHT)} />}
          <div className="border-t border-neutral-800 pt-1">
            <Row l={`Total sur ${q.duration_months} mois HT`} v={eur(t.contractHT)} bold />
            <Row l="Total TTC" v={eur(t.contractTTC)} bold />
          </div>
        </div>

        {hasRent && (
          <div className="mt-6 text-[12px] text-neutral-600">
            Le loyer inclut {INCLUDED_GLASSES} verres par machine (en verre ou en plastique).
          </div>
        )}
        {q.notes && <div className="mt-3 whitespace-pre-wrap text-[12px] text-neutral-700">{q.notes}</div>}
      </div>
    </div>
  );
}

function Row({ l, v, bold }: { l: string; v: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold" : ""}`}>
      <span>{l}</span>
      <span>{v}</span>
    </div>
  );
}
