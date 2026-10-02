-- Contacts : persona + société, et lien N-N entre opportunités et contacts.
-- À exécuter UNE FOIS dans Supabase (SQL Editor) AVANT de déployer le code
-- correspondant. Sans danger si relancé (if not exists).

alter table public.contacts
  add column if not exists persona text,
  add column if not exists company text;   -- société du contact (texte libre)

alter table public.contacts
  drop constraint if exists contacts_persona_check;
alter table public.contacts
  add constraint contacts_persona_check
  check (persona is null or persona in
    ('Achat','RSE','QHSE','Direction de Site','Environnement de Travail'));

-- Une opportunité peut avoir plusieurs contacts, un contact plusieurs opportunités.
create table if not exists public.opportunity_contacts (
  opp_id     uuid not null references public.opportunities(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (opp_id, contact_id)
);
create index if not exists opportunity_contacts_contact_idx
  on public.opportunity_contacts (contact_id);

alter table public.opportunity_contacts enable row level security;

drop policy if exists "opportunity_contacts select" on public.opportunity_contacts;
create policy "opportunity_contacts select" on public.opportunity_contacts for select
  using ( exists (
    select 1 from public.opportunities o
    where o.id = opportunity_contacts.opp_id
      and (o.ae_id = auth.uid() or public.is_direction())
  ) );

drop policy if exists "opportunity_contacts insert" on public.opportunity_contacts;
create policy "opportunity_contacts insert" on public.opportunity_contacts for insert
  with check ( exists (
    select 1 from public.opportunities o
    where o.id = opportunity_contacts.opp_id
      and (o.ae_id = auth.uid() or public.is_direction())
  ) );

drop policy if exists "opportunity_contacts delete" on public.opportunity_contacts;
create policy "opportunity_contacts delete" on public.opportunity_contacts for delete
  using ( exists (
    select 1 from public.opportunities o
    where o.id = opportunity_contacts.opp_id
      and (o.ae_id = auth.uid() or public.is_direction())
  ) );
