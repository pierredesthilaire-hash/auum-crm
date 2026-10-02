-- Nouveau funnel : R1, R2, Test, Négociation, Validation.
-- L'étape « Qualification » disparaît (ses opportunités passent en R1) et « R2 » devient une étape
-- à part entière (les opportunités importées de Dynamics avec la phase R2 y sont replacées).
alter table public.opportunities drop constraint if exists opportunities_stage_check;

update public.opportunities set stage = 'decouverte' where stage = 'qualification';
update public.opportunities set stage = 'r2' where stage = 'demo' and stage_orig = 'R2';

alter table public.opportunities alter column stage set default 'decouverte';
alter table public.opportunities
  add constraint opportunities_stage_check check (stage in ('decouverte','r2','demo','nego','signature'));
