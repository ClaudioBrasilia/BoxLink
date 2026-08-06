-- Duelo passa a registrar o treino como qualquer outro WOD.
--
-- Até aqui o resultado do duelo vivia só dentro de `duels.results` (jsonb):
-- quem treinava duelando não tinha registro no diário, não contava streak,
-- não entrava no placar/ranking e não ganhava XP de WOD (só o vencedor
-- levava o XP de vitória). O treino simplesmente sumia do resto do app.
--
-- `duel_id` marca de onde veio o registro — serve tanto de procedência
-- (dá pra ver no diário que aquele treino foi um duelo) quanto de trava de
-- idempotência: um duelo gera no máximo um registro de treino por atleta,
-- mesmo se a submissão for reprocessada.

alter table public.training_logs
  add column if not exists duel_id uuid references public.duels(id) on delete set null;

create index if not exists training_logs_duel_idx
  on public.training_logs (user_id, duel_id);

comment on column public.training_logs.duel_id is
  'Duelo que originou este registro de treino. Null = treino registrado pelo fluxo normal (cronômetro/Novo Registro).';
