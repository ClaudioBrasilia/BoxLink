-- Corrige WODs duplicados na mesma data.
--
-- Problema: o botão "POSTAR WOD" sempre inseria uma linha nova, mesmo já
-- existindo WOD naquela data. A TV, o Dashboard, o Leaderboard e a tela de
-- WOD buscavam o WOD do dia com maybeSingle(), que retorna erro (data null)
-- quando a consulta encontra mais de uma linha — resultado: o WOD novo era
-- salvo, mas as telas continuavam mostrando o antigo.
--
-- Execute este script no SQL Editor do Supabase.

-- 1. Move os resultados lançados em WODs duplicados para o WOD mais recente
--    de cada data (evita perder resultados quando os duplicados forem removidos)
with keep as (
  select distinct on (date) id, date
  from public.wods
  order by date, created_at desc nulls last, id
)
update public.wod_results r
set wod_id = k.id
from public.wods w
join keep k on k.date = w.date
where r.wod_id = w.id
  and w.id <> k.id;

-- 2. Remove as linhas duplicadas, mantendo a mais recente de cada data
with keep as (
  select distinct on (date) id, date
  from public.wods
  order by date, created_at desc nulls last, id
)
delete from public.wods w
using keep k
where w.date = k.date
  and w.id <> k.id;

-- 3. Garante no máximo um WOD por data daqui pra frente
create unique index if not exists wods_date_unique on public.wods (date);
