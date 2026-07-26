-- Prepara o pedido de entrada para múltiplos boxes. Cada linha de
-- box_settings já representa a configuração de UM box (nome, logo, regras);
-- hoje só existe uma, mas o pedido de entrada e o perfil do atleta passam a
-- guardar A QUAL box ele pediu/pertence, para quando houver mais de um.

alter table public.box_join_requests
  add column if not exists box_id uuid references public.box_settings(id);

alter table public.profiles
  add column if not exists box_id uuid references public.box_settings(id);

-- Backfill: o box existente vira o box de quem já é ou já pediu para ser aluno.
do $$
declare
  v_box_id uuid;
begin
  select id into v_box_id from public.box_settings limit 1;
  if v_box_id is not null then
    update public.box_join_requests set box_id = v_box_id where box_id is null;
    update public.profiles set box_id = v_box_id where box_id is null and account_type = 'box';
  end if;
end $$;
