alter table public.audit_log add column if not exists from_stage text;
alter table public.audit_log add column if not exists to_stage text;
