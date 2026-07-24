-- O WOD do dia agora é postado ANTES de treinar (definição: nome, tipo,
-- movimentos) em "Poste seu WOD", e o resultado só é preenchido depois,
-- ao treinar (via "Iniciar Meu WOD" ou "Novo Registro"). Por isso:
--  • `result` deixa de ser obrigatório na hora de postar a definição.
--  • `description` guarda os movimentos do WOD.

alter table public.daily_wod_results
  alter column result drop not null;

alter table public.daily_wod_results
  add column if not exists description text;
