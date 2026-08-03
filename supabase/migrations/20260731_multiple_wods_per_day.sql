-- Permite mais de um WOD por atleta no mesmo dia (ex: treino dobrado).
-- Cada WOD postado passa a ser sua própria linha, identificada pelo `id`
-- (em vez de uma linha única por user_id+wod_date que era sobrescrita).

do $$ begin
  alter table public.daily_wod_results
    drop constraint daily_wod_results_user_id_wod_date_key;
exception when undefined_object then null; end $$;

create index if not exists daily_wod_results_user_date_idx
  on public.daily_wod_results (user_id, wod_date);
