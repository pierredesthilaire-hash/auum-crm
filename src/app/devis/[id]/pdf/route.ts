import { createClient } from "@/lib/supabase/server";
import { loadQuote } from "@/lib/quoteData";
import { buildQuotePdf } from "@/lib/quotePdf";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const q = await loadQuote(supabase, id);
  if (!q) return new Response("Devis introuvable", { status: 404 });

  const bytes = await buildQuotePdf(q);
  const client = (q.opportunities?.entities?.name ?? "client").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Devis-${q.number}-${client}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
