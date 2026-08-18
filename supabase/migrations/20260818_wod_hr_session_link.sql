-- Associação explícita entre o resultado do WOD e a sessão de FC usada.
-- O vínculo é opcional e a exclusão da sessão nunca remove o resultado do WOD.

alter table public.wod_results
  add column if not exists hr_session_id uuid
  references public.heart_rate_sessions(id)
  on delete set null;

create index if not exists idx_wod_results_hr_session_id
  on public.wod_results (hr_session_id);

comment on column public.wod_results.hr_session_id is
  'Sessão de frequência cardíaca explicitamente associada ao resultado do WOD; opcional para preservar resultados antigos.';

notify pgrst, 'reload schema';
