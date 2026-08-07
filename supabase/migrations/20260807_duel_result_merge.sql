-- Corrige perda de resultado no duelo.
--
-- O app montava o jsonb inteiro a partir do que estava na tela
-- ({...duel.results, [eu]: meu}) e gravava por cima. Com dois atletas de
-- tela aberta, quem enviasse por último apagava o resultado do primeiro:
-- o segundo tinha um retrato antigo do duelo (sem o resultado do outro) e
-- sobrescrevia o objeto todo. Sintoma: um atleta enviou, o treino dele
-- aparece no ranking, mas o duelo mostra "Aguardando" pra ele.
--
-- Agora o merge acontece AQUI, no servidor: cada envio só acrescenta a
-- própria chave (results || {meu_id: resultado}), então um envio nunca
-- pode apagar o do outro, independente do que o cliente tinha em tela.

create or replace function public.submit_duel_result(
  p_duel_id uuid,
  p_result text,
  p_intensity numeric default null,
  p_load numeric default null
)
returns public.duels
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_duel public.duels;
begin
  if v_uid is null then
    raise exception 'Não autenticado';
  end if;

  update public.duels d
     set results   = coalesce(d.results,   '{}'::jsonb) || jsonb_build_object(v_uid::text, p_result),
         intensity = coalesce(d.intensity, '{}'::jsonb) || jsonb_build_object(v_uid::text, p_intensity),
         loads     = coalesce(d.loads,     '{}'::jsonb) || jsonb_build_object(v_uid::text, p_load),
         updated_at = now()
   where d.id = p_duel_id
     -- Só participante envia, e só o próprio resultado (a chave é sempre
     -- auth.uid(), nunca um id vindo do cliente).
     and (d.challenger_id = v_uid or v_uid = any(coalesce(d.opponent_ids, array[]::uuid[])))
  returning d.* into v_duel;

  if v_duel.id is null then
    raise exception 'Duelo não encontrado ou você não é participante';
  end if;

  return v_duel;
end;
$$;

grant execute on function public.submit_duel_result(uuid, text, numeric, numeric) to authenticated;

-- A tela de duelos escuta mudanças em `duels` pra atualizar sozinha quando o
-- outro atleta envia, mas a tabela nunca foi publicada no realtime (só
-- heart_rate_live estava, desde 20260529) — então esse canal nunca recebeu
-- nada e a tela só atualizava recarregando. É também o que deixava o retrato
-- do duelo velho na tela por minutos, alimentando a sobrescrita acima.
do $$
begin
  alter publication supabase_realtime add table public.duels;
exception
  when duplicate_object then null;  -- já publicada
  when undefined_object then null;  -- publication não existe neste ambiente
end $$;
