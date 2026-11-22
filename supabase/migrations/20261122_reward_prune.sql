-- ─────────────────────────────────────────────────────────────────────────────
-- Limpeza automática do histórico de recompensas, sem quebrar o resto do app.
--
-- `reward_history` é a fonte de várias telas, e cada uma lê uma janela
-- diferente:
--   • ranking do mês (Dashboard, Ranking, Diário, TV, Liga) → mês corrente;
--   • pontuação de time (Times) → desde o início da temporada aberta;
--   • histórico de desafios (Desafios) → todas as linhas type = 'challenge'.
--
-- Por isso a limpeza não pode ser um "delete where created_at < X" solto: ela
-- apagaria XP que o time ainda está somando. A função abaixo calcula um corte
-- que respeita as três janelas e preserva as linhas de desafio, que são poucas
-- e alimentam a tela de Desafios.
--
-- Roda por atleta (auth.uid()), chamada pelo app uma vez por dia.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.prune_my_reward_history(p_keep_days int default 60)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_season_start timestamptz;
  v_cutoff timestamptz;
  v_deleted integer := 0;
begin
  if v_uid is null then
    return 0;
  end if;

  -- Início da temporada aberta do box (jsonb em box_settings). O cast só
  -- acontece quando o texto parece uma data, para não estourar exceção.
  select case
           when (current_season->>'start_date') ~ '^\d{4}-\d{2}-\d{2}'
             then (current_season->>'start_date')::timestamptz
           else null
         end
    into v_season_start
    from public.box_settings
   limit 1;

  -- O corte é a MAIS ANTIGA entre as janelas que alguém ainda lê: assim o
  -- delete nunca alcança o que o ranking do mês ou a temporada do time somam.
  -- A folga de um dia cobre fuso: o cliente conta o mês pelo horário local
  -- (Brasília), o banco por UTC.
  v_cutoff := least(
    now() - make_interval(days => greatest(coalesce(p_keep_days, 60), 7)),
    date_trunc('month', now()) - interval '1 day'
  );

  if v_season_start is not null then
    v_cutoff := least(v_cutoff, v_season_start - interval '1 day');
  end if;

  delete from public.reward_history
   where user_id = v_uid
     and created_at < v_cutoff
     -- Desafios montam o histórico da tela Desafios a partir destas linhas.
     and coalesce(type, '') <> 'challenge';

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.prune_my_reward_history(int) from public;
grant execute on function public.prune_my_reward_history(int) to authenticated;

comment on function public.prune_my_reward_history(int) is
  'Apaga o histórico de recompensas do próprio atleta fora da temporada aberta e do mês corrente, preservando as linhas de desafio.';
