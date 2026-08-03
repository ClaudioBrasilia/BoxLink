-- Carga (kg) opcional no resultado do WOD — paridade com o Box (wod_results
-- já tem load_kg). Útil pra WODs com barra com peso (ex: "Fran com 30kg").

alter table public.daily_wod_results
  add column if not exists load_kg numeric;
