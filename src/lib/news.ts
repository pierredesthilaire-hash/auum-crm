import type { SupabaseClient } from "@supabase/supabase-js";

export type NewsItem = { title: string; url: string; source: string; date: string };

export type NewsQuery = {
  key: string; // clé de cache
  q: string; // requête GNews
  must?: string; // texte qui doit figurer dans le titre ou la description (filtre de pertinence)
  max: number;
  days: number;
};

const TTL_MS = 24 * 3600 * 1000;
const SPACING_MS = 1100; // le plan gratuit GNews limite à 1 requête par seconde

export const SECTOR_QUERY =
  '"gobelet réutilisable" OR "verre réutilisable" OR "vaisselle réutilisable" OR "loi AGEC" OR "gobelet jetable" OR "zéro déchet" entreprise';

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const LEGAL = /\b(sas|sasu|sarl|sa|eurl|snc|groupe|group|france|ste)\b/gi;

/** Nom de société nettoyé pour la recherche : sans forme juridique ni parenthèses, 3 mots maximum. */
export function companySearchName(name: string): string {
  const cleaned = name.replace(/\(.*?\)/g, " ").replace(LEGAL, " ").replace(/\s+/g, " ").trim();
  return cleaned.split(" ").slice(0, 3).join(" ");
}

type Gnews = { articles?: { title: string; description?: string; url: string; publishedAt: string; source?: { name?: string } }[] };

type FetchResult = { items: (NewsItem & { description?: string })[] } | { error: "quota" | "failed" };

async function gnewsSearch(q: NewsQuery): Promise<FetchResult> {
  const key = process.env.GNEWS_API_KEY!;
  const from = new Date(Date.now() - q.days * 86_400_000).toISOString().replace(/\.\d+Z$/, "Z");
  const url =
    `https://gnews.io/api/v4/search?q=${encodeURIComponent(q.q)}&lang=fr&country=fr&max=10` +
    `&from=${encodeURIComponent(from)}&sortby=publishedAt&apikey=${key}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (res.status === 403 || res.status === 429) return { error: "quota" };
    if (!res.ok) return { error: "failed" };
    const json = (await res.json()) as Gnews;
    return {
      items: (json.articles ?? []).map((a) => ({
        title: a.title,
        description: a.description,
        url: a.url,
        source: a.source?.name ?? "",
        date: a.publishedAt,
      })),
    };
  } catch {
    return { error: "failed" };
  }
}

/**
 * Renvoie les actualités de chaque requête depuis le cache partagé (24 h). Les requêtes absentes ou périmées sont
 * interrogées à GNews, dans la limite de `budget` appels par exécution ; `pending` indique ce qui reste à charger.
 */
export async function getNews(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  queries: NewsQuery[],
  budget: number,
): Promise<{ results: Map<string, NewsItem[]>; pending: number; quota: boolean }> {
  const { data: rows } = await supabase.from("news_cache").select("key, items, fetched_at").in("key", queries.map((q) => q.key));
  const cached = new Map<string, { items: (NewsItem & { description?: string })[]; fresh: boolean }>();
  for (const r of rows ?? []) {
    cached.set(r.key, { items: r.items ?? [], fresh: Date.now() - new Date(r.fetched_at).getTime() < TTL_MS });
  }

  let quota = false;
  let used = 0;
  let pending = 0;
  for (const q of queries) {
    if (cached.get(q.key)?.fresh) continue;
    if (quota || used >= budget) {
      pending += 1;
      continue;
    }
    if (used > 0) await new Promise((r) => setTimeout(r, SPACING_MS));
    used += 1;
    const r = await gnewsSearch(q);
    if ("error" in r) {
      if (r.error === "quota") quota = true;
      continue;
    }
    cached.set(q.key, { items: r.items, fresh: true });
    await supabase.from("news_cache").upsert({ key: q.key, items: r.items, fetched_at: new Date().toISOString() });
  }

  const results = new Map<string, NewsItem[]>();
  for (const q of queries) {
    const items = cached.get(q.key)?.items ?? [];
    const must = q.must ? norm(q.must) : null;
    const kept = items
      .filter((i) => !must || norm(`${i.title} ${i.description ?? ""}`).includes(must))
      .slice(0, q.max)
      .map((i) => ({ title: i.title, url: i.url, source: i.source, date: i.date }));
    results.set(q.key, kept);
  }
  return { results, pending, quota };
}
