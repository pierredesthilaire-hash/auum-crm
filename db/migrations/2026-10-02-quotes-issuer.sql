-- Entité émettrice du devis : Auum ou Auum Finance.
alter table public.quotes
  add column if not exists issuer text not null default 'auum' check (issuer in ('auum','auum_finance'));
