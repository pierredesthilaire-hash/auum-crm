-- =====================================================================
-- CRM auum — Schéma PostgreSQL (Supabase)
-- Aligné sur le modèle de données du prototype (prototype/auum-crm-prototype.html)
-- Mission 1 : créer ces tables, importer data/seed.json, brancher l'auth.
-- =====================================================================

-- ---------- Utilisateurs (miroir de auth.users Supabase) ----------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  role        text not null default 'ae' check (role in ('ae','direction')),
  created_at  timestamptz default now()
);

-- ---------- Segmentation (config éditable par la direction) ----------
create table public.settings (
  key   text primary key,          -- 'seg_config', 'benchmarks', 'seg_owners'
  value jsonb not null
);

-- ---------- Groupes (sociétés mères) ----------
create table public.groups (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  auto       boolean default false,          -- rapprochement suggéré à valider
  created_at timestamptz default now()
);

-- ---------- Entités juridiques (comptes) ----------
create table public.entities (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  group_id    uuid references public.groups(id) on delete set null,
  siret       text,
  sector      text,
  headcount   integer,                        -- effectif → segment calculé
  parc        integer default 0,              -- machines installées
  parc_note   text,
  owner_id    uuid references public.profiles(id) on delete set null,  -- AE référent
  created_at  timestamptz default now()
);
create index on public.entities (group_id);
create index on public.entities (owner_id);

-- segment calculé (vue) : seuils lus dans settings.seg_config
create or replace view public.entities_with_segment as
select e.*,
  case
    when e.headcount is null then null
    when e.headcount < coalesce((select (value->>'smb')::int from settings where key='seg_config'), 500) then 'smb'
    when e.headcount <= coalesce((select (value->>'grand')::int from settings where key='seg_config'), 1000) then 'grand'
    else 'cle'
  end as segment
from public.entities e;

-- ---------- Contacts ----------
create table public.contacts (
  id         uuid primary key default gen_random_uuid(),
  entity_id  uuid references public.entities(id) on delete cascade,
  full_name  text not null,
  role       text,                            -- RSE, Services Généraux, QHSE…
  email      text,
  phone      text,
  linkedin   text,
  created_at timestamptz default now()
);
create index on public.contacts (entity_id);
create index on public.contacts (email);      -- rapprochement Outlook

-- ---------- Opportunités ----------
create table public.opportunities (
  id            uuid primary key default gen_random_uuid(),
  dyn_id        text,                         -- id Dynamics d'origine
  name          text not null,
  entity_id     uuid not null references public.entities(id),
  ae_id         uuid not null references public.profiles(id),
  stage         text not null default 'qualification'
                check (stage in ('qualification','decouverte','demo','nego','signature')),
  stage_orig    text,                         -- phase Dynamics d'origine
  state         text not null default 'open' check (state in ('open','won','lost')),
  machines      integer not null default 1,
  amount        numeric(12,2) not null default 0,
  prob          integer not null default 20 check (prob between 0 and 100),
  source        text,                         -- provenance du lead
  close_date    date,
  install_date  date,
  closed_on     date,
  notes         text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
create index on public.opportunities (ae_id, state);
create index on public.opportunities (entity_id);
create index on public.opportunities (close_date);

-- ---------- Prospects ----------
create table public.prospects (
  id          uuid primary key default gen_random_uuid(),
  company     text not null,
  entity_id   uuid references public.entities(id) on delete set null,  -- lié si converti/rapproché
  contact     text,
  role        text,
  email       text,
  phone       text,
  linkedin    text,
  city        text,
  sector      text,
  headcount   integer,
  ae_id       uuid references public.profiles(id) on delete set null,
  status      text not null default 'a_contacter'
              check (status in ('a_contacter','contacte','r1_planifie','r1_realise','converti','sans_suite')),
  seq         text,                            -- nom de campagne outbound
  source      text,
  opp_id      uuid references public.opportunities(id) on delete set null,
  created_at  timestamptz default now()
);
create index on public.prospects (ae_id, status);

-- ---------- Touches (contacts tracés : email / tel / linkedin) ----------
create table public.touches (
  id          uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  type        text not null check (type in ('email','tel','linkedin')),
  at          timestamptz default now(),
  source      text default 'manuel'            -- 'manuel' | 'outlook' | 'emelia'
);
create index on public.touches (prospect_id);

-- ---------- Tâches ----------
create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  type         text default 'Autre',
  due          date,
  owner_id     uuid not null references public.profiles(id),
  created_by   uuid references public.profiles(id),   -- null si règle auto
  opp_id       uuid references public.opportunities(id) on delete cascade,
  prospect_id  uuid references public.prospects(id) on delete cascade,
  note         text,
  auto         boolean default false,
  rule         text,                                   -- 'aging' | 'late' | 'nodate'
  status       text not null default 'open' check (status in ('open','done','dismissed')),
  done_on      date,
  created_at   timestamptz default now(),
  unique (rule, opp_id)                                -- idempotence des règles auto
);
create index on public.tasks (owner_id, status, due);

-- ---------- Journal d'audit ----------
create table public.audit_log (
  id             bigint generated always as identity primary key,
  at             timestamptz default now(),
  user_id        uuid references public.profiles(id),
  opp_id         uuid references public.opportunities(id) on delete set null,
  type           text not null,   -- opp_created, stage_change, field_change, opp_won, opp_lost, parc_update, task, bdd_request, bdd_decision, outbound
  detail         text,
  dir            text,            -- 'up' | 'down' pour stage_change
  delta_machines integer,
  delta_amount   numeric(12,2)
);
create index on public.audit_log (at desc);
create index on public.audit_log (opp_id);

-- ---------- Demandes de génération de BDD ----------
create table public.bdd_requests (
  id          uuid primary key default gen_random_uuid(),
  ref         text unique,                     -- REQ-001
  ae_id       uuid not null references public.profiles(id),
  tool        text,
  target_n    integer,
  naf         text, loc text, functions text, size text, why text,
  hmin        integer, hmax integer,
  enrich      text check (enrich in ('both','email','tel','none')),
  status      text not null default 'review'
              check (status in ('review','pending','approved','rejected','imported')),
  found       jsonb default '[]',              -- personas trouvés + keep
  comment     text,
  decided_by  uuid references public.profiles(id),
  decided_on  date,
  created_at  timestamptz default now()
);

-- ---------- Campagnes outbound ----------
create table public.campaigns (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        text check (type in ('email','linkedin','multi')),
  ae_id       uuid references public.profiles(id),
  prospect_ids uuid[] default '{}',
  stats       jsonb default '{"sent":0,"opened":0,"replied":0,"rdv":0}',
  external_id text,                            -- id campagne Emelia/Lemlist
  created_at  timestamptz default now()
);

-- ---------- Signaux d'affaires (actus comptes) & mouvements de poste ----------
create table public.news (
  id         uuid primary key default gen_random_uuid(),
  entity_id  uuid references public.entities(id) on delete cascade,
  date       date not null,
  title      text not null,
  summary    text,
  signal     text,
  suggestion text,
  url        text,
  created_at timestamptz default now()
);
create table public.job_changes (
  id          uuid primary key default gen_random_uuid(),
  person      text not null,
  entity_id   uuid references public.entities(id) on delete set null,
  prospect_id uuid references public.prospects(id) on delete set null,
  prev_role   text, new_role text, company text,
  kind        text check (kind in ('promotion','arrivee','depart')),
  date        date,
  suggestion  text,
  created_at  timestamptz default now()
);

-- ---------- RDV (miroir Outlook, mission 2) ----------
create table public.meetings (
  id         uuid primary key default gen_random_uuid(),
  ae_id      uuid references public.profiles(id),
  graph_id   text unique,                      -- id de l'événement Microsoft Graph
  date       date, start_time time, end_time time,
  title      text, with_who text, place text,
  opp_id     uuid references public.opportunities(id) on delete set null,
  entity_id  uuid references public.entities(id) on delete set null
);

-- =====================================================================
-- RLS (Row Level Security) — Mission 1 : version simple
--   direction : accès total | AE : ses lignes (ae_id / owner_id = lui)
--   Les policies détaillées sont à écrire avec Claude Code, table par table.
-- =====================================================================
alter table public.opportunities enable row level security;
alter table public.prospects     enable row level security;
alter table public.tasks         enable row level security;
alter table public.entities      enable row level security;
-- Exemple de policy (à décliner) :
-- create policy "ae voit ses oppos" on public.opportunities for select
--   using ( ae_id = auth.uid()
--           or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'direction') );
