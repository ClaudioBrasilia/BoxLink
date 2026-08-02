-- ─────────────────────────────────────────────────────────────────────────────
-- Carga usada no WOD → força relativa (carga ÷ peso corporal)
--
-- Num WOD RX todo mundo levanta a MESMA carga prescrita, então comparar carga
-- bruta entre atletas não diz nada. O que diferencia é quanto do próprio peso
-- corporal cada um moveu: 43kg de thruster são 0.74x o peso de uma atleta de
-- 58kg e 0.45x o de um atleta de 95kg — a mesma barra é um treino muito mais
-- pesado para ela. É a mesma leitura do "work-to-body-mass ratio" usado nas
-- análises de atletas do CrossFit Games.
--
-- O peso corporal já existe em profiles.weight_kg. Faltava a carga do treino.
-- Nulo quando o WOD não tem carga (corrida, burpee) ou o atleta não preencheu —
-- nesse caso a UI simplesmente omite a métrica.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.wod_results add column if not exists load_kg numeric;

comment on column public.wod_results.load_kg is
  'Carga (kg) usada pelo atleta no WOD. Com profiles.weight_kg vira força relativa (carga ÷ peso corporal).';

-- Duelo: mesma ideia, um valor por participante (mesmo formato de `intensity`).
alter table public.duels add column if not exists loads jsonb not null default '{}'::jsonb;

comment on column public.duels.loads is
  'Carga (kg) por participante: { "<user_id>": 43 }. Usada para a força relativa no recap do duelo.';
