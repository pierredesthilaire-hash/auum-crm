-- Cache partagé des actualités (API GNews) : une requête par société et par jour pour toute l'équipe.
create table public.news_cache (
  key        text primary key,
  items      jsonb not null default '[]',
  fetched_at timestamptz not null default now()
);
alter table public.news_cache enable row level security;
create policy "news_cache select" on public.news_cache for select using ( auth.uid() is not null );
create policy "news_cache insert" on public.news_cache for insert with check ( auth.uid() is not null );
create policy "news_cache update" on public.news_cache for update using ( auth.uid() is not null );
