-- Resultado de duelo AMRAP em "rounds+reps".
--
-- O duelo passou a pedir o resultado de AMRAP em rounds + reps (mesmo formato
-- do WOD do dia e do placar), em vez de um total de reps digitado à mão. Para
-- converter "5+12" em total de reps — no ritmo (reps/min) e na comparação de
-- desempenho — é preciso saber quantas reps tem um round completo.
--
-- Duelo de box lê esse número da tabela `wods` (reps_per_round). Duelo de WOD
-- personalizado (individual) tem wod_id = null, então o número vive direto na
-- linha do duelo, ao lado de total_reps / time_cap_minutes.
--
-- Sem o número o duelo continua funcionando: a comparação usa um peso de round
-- inferido dos próprios resultados (ver inferRoundWeight em src/lib/pace.ts),
-- que mantém a ordem correta — só o ritmo fica de fora.

alter table public.duels
  add column if not exists reps_per_round integer;

comment on column public.duels.reps_per_round is
  'WOD personalizado AMRAP: reps de um round completo. Converte o resultado "rounds+reps" em total de reps (ritmo e comparação de desempenho).';
