-- Fecha um vazamento de privacidade: a busca de oponente de duelo do lado do
-- box (Duels.tsx) nunca filtrou por box_id — todo aluno aprovado, de
-- qualquer box ou conta individual, aparecia na busca por nome de qualquer
-- outro aluno de box. box_id existe em profiles desde 20260729_multi_box.sql,
-- mas só foi preenchido numa migration única e o fluxo padrão de aprovação
-- (Admin > handleStatusChange) nunca setou a coluna — então a maioria dos
-- alunos de box aprovados depois daquela migration ficou com box_id nulo.
--
-- Como hoje só existe um box, o default abaixo é seguro: qualquer conta
-- account_type='box' sem box_id passa a usar o box existente, tanto pra
-- quem já está aprovado (backfill) quanto pra aprovações/cadastros futuros
-- (trigger) — sem depender de cada tela lembrar de setar a coluna.

-- Backfill: cobre quem já está com account_type='box' e box_id nulo hoje.
do $$
declare
  v_box_id uuid;
begin
  select id into v_box_id from public.box_settings limit 1;
  if v_box_id is not null then
    update public.profiles set box_id = v_box_id where box_id is null and account_type = 'box';
  end if;
end $$;

-- Daqui pra frente: qualquer insert/update que deixe account_type='box' com
-- box_id nulo recebe o box existente automaticamente.
create or replace function public.default_box_id()
returns trigger as $$
declare
  v_box_id uuid;
begin
  if new.account_type = 'box' and new.box_id is null then
    select id into v_box_id from public.box_settings limit 1;
    if v_box_id is not null then
      new.box_id := v_box_id;
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_default_box_id on public.profiles;
create trigger trg_default_box_id
  before insert or update on public.profiles
  for each row execute procedure public.default_box_id();
