-- Permet à un AE de remplacer ses propres RDV lors de la synchro Outlook
-- (suppression des RDV annulés ou déplacés dans la fenêtre synchronisée).
create policy "meetings delete own" on public.meetings for delete
  using ( ae_id = auth.uid() );
