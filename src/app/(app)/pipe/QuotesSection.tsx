"use client";

import { useState, useTransition } from "react";
import {
  DURATIONS,
  INCLUDED_GLASSES,
  PRODUCTS,
  QUOTE_STATUSES,
  RENT_BY_DURATION,
  computeTotals,
  eur,
  lineFromProduct,
  machineLine,
  type Duration,
  type QuoteLine,
  type QuoteRow,
} from "@/lib/quotes";
import { addDaysISO, todayISO } from "@/lib/dates";
import { deleteQuote, saveQuote } from "./quoteActions";
import type { OppRow } from "./types";

export function QuotesSection({ opp }: { opp: OppRow }) {
  const quotes = [...(opp.quotes ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const [editing, setEditing] = useState<QuoteRow | "new" | null>(null);
  const [pending, startTransition] = useTransition();

  const remove = (q: QuoteRow) => {
    if (!window.confirm(`Supprimer le devis ${q.number} ?`)) return;
    startTransition(async () => {
      await deleteQuote(q.id);
    });
  };

  return (
    <div>
      <div className="mb-2 mt-4 flex items-center gap-2">
        <div className="text-xs font-semibold uppercase tracking-wide">Devis</div>
        <button onClick={() => setEditing("new")} className="btn ml-auto" type="button">
          + Nouveau devis
        </button>
      </div>
      {quotes.length === 0 ? (
        <div className="text-[11.5px] text-[var(--muted)]">Aucun devis pour cette opportunité.</div>
      ) : (
        <div className="space-y-1.5">
          {quotes.map((q) => {
            const t = computeTotals(q.lines, q.duration_months, q.vat_rate);
            return (
              <div key={q.id} className="rounded-lg border p-2 text-[12px]" style={{ borderColor: "var(--line)" }}>
                <div className="flex items-center gap-2">
                  <b>{q.number}</b>
                  <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: "var(--teal-soft)" }}>
                    {q.status}
                  </span>
                  <span className="ml-auto text-[var(--muted)]">{new Date(q.created_at).toLocaleDateString("fr-FR")}</span>
                </div>
                <div className="mt-0.5 text-[var(--muted)]">
                  {q.duration_months} mois · {eur(t.monthlyHT)} HT/mois · {eur(t.contractHT)} HT sur la durée
                </div>
                <div className="mt-1 flex gap-3 text-[11.5px]">
                  <button type="button" onClick={() => setEditing(q)} className="underline">
                    Modifier
                  </button>
                  <a href={`/devis/${q.id}`} target="_blank" rel="noreferrer" className="underline">
                    Aperçu / PDF
                  </a>
                  <button type="button" onClick={() => remove(q)} disabled={pending} className="ml-auto text-[var(--red)] underline">
                    Supprimer
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {editing && <QuoteEditor key={editing === "new" ? "new" : editing.id} opp={opp} quote={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function QuoteEditor({ opp, quote, onClose }: { opp: OppRow; quote: QuoteRow | null; onClose: () => void }) {
  const [duration, setDuration] = useState<number>(quote?.duration_months ?? 36);
  const [vat, setVat] = useState(quote?.vat_rate ?? 20);
  const [validUntil, setValidUntil] = useState(quote?.valid_until ?? addDaysISO(todayISO(), 30));
  const [status, setStatus] = useState(quote?.status ?? "brouillon");
  const [notes, setNotes] = useState(quote?.notes ?? "");
  const [lines, setLines] = useState<QuoteLine[]>(
    quote?.lines ?? [machineLine(Math.max(1, opp.machines || 1), 36)],
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const totals = computeTotals(lines, duration, vat);

  const changeDuration = (d: number) => {
    setDuration(d);
    // Le loyer machine suit la durée choisie.
    setLines((ls) => ls.map((l) => (l.code === "machine" ? { ...l, unit_price: RENT_BY_DURATION[d as Duration] } : l)));
  };
  const patch = (i: number, p: Partial<QuoteLine>) => setLines((ls) => ls.map((l, k) => (k === i ? { ...l, ...p } : l)));
  const add = (code: string) => {
    const p = PRODUCTS.find((x) => x.code === code);
    if (!p) return;
    setLines((ls) => [...ls, p.code === "machine" ? machineLine(1, duration as Duration) : lineFromProduct(p)]);
  };

  const save = () => {
    setError(null);
    startTransition(async () => {
      const r = await saveQuote(opp.id, quote?.id ?? null, {
        duration_months: duration,
        vat_rate: vat,
        valid_until: validUntil || null,
        status,
        notes,
        lines,
      });
      if (!r.ok) {
        setError(r.error ?? "Échec de l'enregistrement");
        return;
      }
      onClose();
    });
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" style={{ background: "rgba(14,20,17,.45)" }}>
      <div className="flex max-h-[92vh] w-[760px] max-w-full flex-col rounded-xl bg-white shadow-2xl">
        <div className="border-b p-4" style={{ borderColor: "var(--line)" }}>
          <div className="font-display text-[15px] font-semibold">
            {quote ? `Devis ${quote.number}` : "Nouveau devis"} — {opp.entities?.name}
          </div>
          <div className="text-[11.5px] text-[var(--muted)]">{opp.name}</div>
        </div>

        <div className="space-y-3 overflow-y-auto p-4 text-[12.5px]">
          <div className="grid grid-cols-4 gap-2">
            <label className="flex flex-col gap-1 text-xs font-semibold">
              Durée d&apos;engagement
              <select className="input" value={duration} onChange={(e) => changeDuration(Number(e.target.value))}>
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} mois — {RENT_BY_DURATION[d]} €/mois
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold">
              TVA (%)
              <input className="input" type="number" min={0} max={100} step="0.1" value={vat} onChange={(e) => setVat(Number(e.target.value))} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold">
              Valable jusqu&apos;au
              <input className="input" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold">
              Statut
              <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
                {QUOTE_STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="text-[11px] text-[var(--muted)]">
            Le loyer inclut {INCLUDED_GLASSES} verres par machine (en verre ou en plastique).
          </div>

          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-[10.5px] uppercase text-[var(--muted)]">
                <th className="pb-1">Produit / service</th>
                <th className="w-16 pb-1">Qté</th>
                <th className="w-24 pb-1">Prix HT</th>
                <th className="w-28 pb-1">Facturation</th>
                <th className="w-24 pb-1 text-right">Total HT</th>
                <th className="w-6" />
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i} className="border-t align-top" style={{ borderColor: "var(--line)" }}>
                  <td className="py-1 pr-2">
                    <input className="input" value={l.label} onChange={(e) => patch(i, { label: e.target.value })} />
                    {l.unit_price === 0 && <div className="mt-0.5 text-[10.5px] text-[var(--red)]">Prix à renseigner</div>}
                  </td>
                  <td className="py-1 pr-2">
                    <input className="input" type="number" min={1} value={l.qty} onChange={(e) => patch(i, { qty: Number(e.target.value) })} />
                  </td>
                  <td className="py-1 pr-2">
                    <input className="input" type="number" min={0} step="0.01" value={l.unit_price} onChange={(e) => patch(i, { unit_price: Number(e.target.value) })} />
                  </td>
                  <td className="py-1 pr-2">
                    <select className="input" value={l.period} onChange={(e) => patch(i, { period: e.target.value as QuoteLine["period"] })}>
                      <option value="monthly">Par mois</option>
                      <option value="once">Une fois</option>
                    </select>
                  </td>
                  <td className="py-1 pr-2 pt-2 text-right font-semibold">{eur(l.qty * l.unit_price)}</td>
                  <td className="py-1 pt-1.5">
                    <button type="button" onClick={() => setLines((ls) => ls.filter((_, k) => k !== i))} title="Retirer" className="text-[var(--red)]">
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <select
            className="input"
            style={{ width: 280 }}
            value=""
            onChange={(e) => {
              add(e.target.value);
              e.target.value = "";
            }}
          >
            <option value="">+ Ajouter un produit…</option>
            {PRODUCTS.map((p) => (
              <option key={p.code} value={p.code}>
                {p.label}
              </option>
            ))}
          </select>

          <label className="flex flex-col gap-1 text-xs font-semibold">
            Notes / conditions (visibles sur le devis)
            <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>

          <div className="rounded-lg p-3" style={{ background: "var(--teal-soft)" }}>
            <div className="flex justify-between">
              <span>Mensualités ({duration} mois)</span>
              <b>
                {eur(totals.monthlyHT)} HT / mois · {eur(totals.monthlyTTC)} TTC
              </b>
            </div>
            <div className="flex justify-between">
              <span>Frais ponctuels</span>
              <b>
                {eur(totals.onceHT)} HT · {eur(totals.onceTTC)} TTC
              </b>
            </div>
            <div className="flex justify-between border-t pt-1 mt-1" style={{ borderColor: "var(--line)" }}>
              <span>Total sur la durée du contrat</span>
              <b>
                {eur(totals.contractHT)} HT · {eur(totals.contractTTC)} TTC
              </b>
            </div>
          </div>
          {error && <div className="text-xs font-semibold text-[var(--red)]">{error}</div>}
        </div>

        <div className="flex items-center gap-2 border-t p-4" style={{ borderColor: "var(--line)" }}>
          <button type="button" onClick={onClose} className="btn">
            Annuler
          </button>
          <button type="button" onClick={save} disabled={pending} className="btn-primary ml-auto">
            {pending ? "Enregistrement…" : "Enregistrer le devis"}
          </button>
        </div>
      </div>
    </div>
  );
}
