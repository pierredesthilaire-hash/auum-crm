-- Devis rattachés à une opportunité. Les lignes sont figées dans le devis (jsonb).
create sequence if not exists public.quote_seq;

create table public.quotes (
  id              uuid primary key default gen_random_uuid(),
  number          text unique not null
                  default ('D-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.quote_seq')::text, 4, '0')),
  opp_id          uuid not null references public.opportunities(id) on delete cascade,
  ae_id           uuid not null references public.profiles(id),
  created_at      timestamptz default now(),
  duration_months int not null check (duration_months in (24, 36, 48)),
  vat_rate        numeric(5,2) not null default 20,
  valid_until     date,
  status          text not null default 'brouillon' check (status in ('brouillon','envoyé','accepté','refusé')),
  notes           text,
  lines           jsonb not null default '[]'
);
create index on public.quotes (opp_id);

alter table public.quotes enable row level security;
create policy "quotes select" on public.quotes for select using ( ae_id = auth.uid() or public.is_direction() );
create policy "quotes insert" on public.quotes for insert with check ( ae_id = auth.uid() or public.is_direction() );
create policy "quotes update" on public.quotes for update using ( ae_id = auth.uid() or public.is_direction() );
create policy "quotes delete" on public.quotes for delete using ( ae_id = auth.uid() or public.is_direction() );
