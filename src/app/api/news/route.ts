import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/currentUser";
import { SECTOR_QUERY, companySearchName, getNews, type NewsItem } from "@/lib/news";
import { stageOf } from "@/lib/stages";

export const maxDuration = 30;

type CompanyNews = { name: string; openOpp: boolean; stage: string | null; items: NewsItem[] };

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!process.env.GNEWS_API_KEY) return NextResponse.json({ error: "not_configured" });

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope");
  const supabase = await createClient();

  if (scope === "sector") {
    const { results, quota } = await getNews(
      supabase,
      [{ key: "sector", q: SECTOR_QUERY, max: 6, days: 14 }],
      1,
    );
    return NextResponse.json({ items: results.get("sector") ?? [], quota });
  }

  // Actualités des clients de l'AE et des sociétés où il a une opportunité ouverte.
  const aeId = user.isDirection && searchParams.get("ae") ? searchParams.get("ae")! : user.id;
  const [{ data: entities }, { data: opps }] = await Promise.all([
    supabase.from("entities").select("name, parc").eq("owner_id", aeId),
    supabase
      .from("opportunities")
      .select("stage, entities(name)")
      .eq("ae_id", aeId)
      .eq("state", "open")
      .returns<{ stage: string; entities: { name: string } | null }[]>(),
  ]);

  const companies = new Map<string, { name: string; openOpp: boolean; stage: string | null; parc: number }>();
  for (const e of entities ?? []) companies.set(e.name, { name: e.name, openOpp: false, stage: null, parc: e.parc ?? 0 });
  for (const o of opps ?? []) {
    const n = o.entities?.name;
    if (!n) continue;
    const c = companies.get(n) ?? { name: n, openOpp: true, stage: o.stage, parc: 0 };
    c.openOpp = true;
    c.stage = o.stage;
    companies.set(n, c);
  }
  // Opportunités ouvertes d'abord, puis plus gros parc ; 30 sociétés maximum.
  const list = [...companies.values()]
    .sort((a, b) => Number(b.openOpp) - Number(a.openOpp) || b.parc - a.parc)
    .slice(0, 30);

  const queries = list.map((c) => {
    const term = companySearchName(c.name);
    return { key: `co:${term.toLowerCase()}`, q: `"${term}"`, must: term, max: 2, days: 30 };
  });
  const { results, pending, quota } = await getNews(supabase, queries, 6);

  const out: CompanyNews[] = list
    .map((c, i) => ({ name: c.name, openOpp: c.openOpp, stage: c.stage ? stageOf(c.stage)?.label ?? null : null, items: results.get(queries[i].key) ?? [] }))
    .filter((c) => c.items.length);
  return NextResponse.json({ companies: out, pending, quota, total: list.length });
}
