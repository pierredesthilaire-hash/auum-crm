import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { INCLUDED_GLASSES, ISSUERS, computeTotals, lineTotal } from "@/lib/quotes";
import type { QuoteFull } from "@/lib/quoteData";

// Les polices PDF standard n'encodent que le Latin-1 + quelques signes (€, tirets, apostrophes) :
// on normalise les espaces insécables fines produites par toLocaleString et on remplace le reste.
const clean = (s: string) =>
  s
    .replace(/[  ]/g, " ")
    .replace(/[^\x20-\x7E¡-ÿ€’‘“”–—…]/g, "?");

function money(n: number): string {
  const [i, d] = Math.abs(n).toFixed(2).split(".");
  return `${n < 0 ? "-" : ""}${i.replace(/\B(?=(\d{3})+(?!\d))/g, " ")},${d} €`;
}
const fr = (iso: string) => new Date(iso).toLocaleDateString("fr-FR");

const PINE = rgb(0.055, 0.247, 0.188);
const TEAL = rgb(0.078, 0.62, 0.494);
const GREY = rgb(0.42, 0.45, 0.43);
const LINE = rgb(0.82, 0.84, 0.83);

function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n").map(clean)) {
    let cur = "";
    for (const w of para.split(" ")) {
      const test = cur ? `${cur} ${w}` : w;
      if (font.widthOfTextAtSize(test, size) > maxW && cur) {
        out.push(cur);
        cur = w;
      } else cur = test;
    }
    out.push(cur);
  }
  return out;
}

export async function buildQuotePdf(q: QuoteFull): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28, H = 841.89, M = 48;

  let page: PDFPage = pdf.addPage([W, H]);
  let y = H - M;

  const text = (t: string, x: number, size = 10, f: PDFFont = font, color = rgb(0.08, 0.1, 0.09)) =>
    page.drawText(clean(t), { x, y, size, font: f, color });
  const right = (t: string, xr: number, size = 10, f: PDFFont = font) => {
    const s = clean(t);
    page.drawText(s, { x: xr - f.widthOfTextAtSize(s, size), y, size, font: f, color: rgb(0.08, 0.1, 0.09) });
  };
  const rule = (yy: number, thick = 0.6, color = LINE) =>
    page.drawLine({ start: { x: M, y: yy }, end: { x: W - M, y: yy }, thickness: thick, color });
  const ensure = (need: number) => {
    if (y - need < M) {
      page = pdf.addPage([W, H]);
      y = H - M;
    }
  };

  const issuer = ISSUERS[q.issuer] ?? ISSUERS.auum;
  const t = computeTotals(q.lines, q.duration_months, q.vat_rate);

  // En-tête
  page.drawText("auum", { x: M, y: y - 22, size: 30, font: bold, color: PINE });
  page.drawText(".", { x: M + bold.widthOfTextAtSize("auum", 30), y: y - 22, size: 30, font: bold, color: TEAL });
  right(`Devis ${q.number}`, W - M, 15, bold);
  y -= 18;
  right(`Émis le ${fr(q.created_at)}`, W - M, 9.5);
  if (q.valid_until) {
    y -= 13;
    right(`Valable jusqu'au ${fr(q.valid_until)}`, W - M, 9.5);
  }
  y -= 22;
  text(issuer.name, M, 9, bold);
  for (const l of [issuer.legal, issuer.address, issuer.ids]) {
    y -= 12;
    text(l, M, 8.5, font, GREY);
  }

  // Client / interlocuteur
  y -= 30;
  const contact = q.opportunities?.opportunity_contacts?.map((x) => x.contacts).find(Boolean) ?? null;
  const topY = y;
  text("CLIENT", M, 8, bold, GREY);
  y -= 15;
  text(q.opportunities?.entities?.name ?? "", M, 12, bold);
  if (contact) {
    y -= 13;
    text(`À l'attention de ${contact.full_name}${contact.role ? `, ${contact.role}` : ""}`, M, 9.5);
    if (contact.email) {
      y -= 12;
      text(contact.email, M, 9.5);
    }
  }
  const leftEnd = y;
  y = topY;
  text("VOTRE INTERLOCUTEUR AUUM", W / 2 + 20, 8, bold, GREY);
  y -= 15;
  text(q.opportunities?.profiles?.full_name ?? "", W / 2 + 20, 11, bold);
  y = Math.min(leftEnd, y) - 22;

  text(`Projet : ${q.opportunities?.name ?? ""}`, M, 9.5);
  y -= 13;
  text(`Engagement de ${q.duration_months} mois`, M, 9.5, bold);

  // Tableau
  const hasDiscount = q.lines.some((l) => (l.discount ?? 0) > 0);
  const col = { qty: 340, unit: 410, disc: 450, tot: W - M };
  y -= 24;
  const head = () => {
    text("DÉSIGNATION", M, 8, bold, GREY);
    right("QTÉ", col.qty, 8, bold);
    right("PRIX UNIT. HT", col.unit + 20, 8, bold);
    if (hasDiscount) right("REMISE", col.disc + 25, 8, bold);
    right("TOTAL HT", col.tot, 8, bold);
    rule(y - 6, 1.2, rgb(0.1, 0.12, 0.11));
    y -= 20;
  };
  head();
  for (const l of q.lines) {
    const labelLines = wrap(`${l.label}${l.period === "monthly" ? " (par mois)" : ""}`, font, 9.5, col.qty - M - 30);
    ensure(labelLines.length * 12 + 10);
    labelLines.forEach((ln, k) => {
      if (k > 0) y -= 12;
      text(ln, M, 9.5);
    });
    const yRow = y + (labelLines.length - 1) * 12;
    const save = y;
    y = yRow;
    right(String(l.qty), col.qty, 9.5);
    right(money(l.unit_price), col.unit + 20, 9.5);
    if (hasDiscount && (l.discount ?? 0) > 0) right(`${l.discount} %`, col.disc + 25, 9.5);
    right(money(lineTotal(l)), col.tot, 9.5);
    y = save;
    rule(y - 6);
    y -= 20;
  }

  // Totaux
  ensure(110);
  y -= 4;
  const tx = W - M - 250;
  const row = (label: string, value: string, strong = false) => {
    page.drawText(clean(label), { x: tx, y, size: 9.5, font: strong ? bold : font, color: rgb(0.08, 0.1, 0.09) });
    right(value, W - M, 9.5, strong ? bold : font);
    y -= 14;
  };
  row("Mensualités HT (par mois)", money(t.monthlyHT));
  row(`Mensualités TTC (TVA ${q.vat_rate} %)`, money(t.monthlyTTC));
  if (t.onceHT > 0) row("Frais ponctuels HT", money(t.onceHT));
  rule(y + 6, 1, rgb(0.1, 0.12, 0.11));
  y -= 4;
  row(`Total sur ${q.duration_months} mois HT`, money(t.contractHT), true);
  row("Total TTC", money(t.contractTTC), true);

  // Mentions
  y -= 12;
  if (q.lines.some((l) => l.code === "machine")) {
    ensure(20);
    text(`Le loyer inclut ${INCLUDED_GLASSES} verres par machine (en verre ou en plastique).`, M, 9, font, GREY);
    y -= 14;
  }
  if (q.notes) {
    for (const ln of wrap(q.notes, font, 9, W - 2 * M)) {
      ensure(14);
      text(ln, M, 9, font, GREY);
      y -= 12;
    }
  }

  return pdf.save();
}
