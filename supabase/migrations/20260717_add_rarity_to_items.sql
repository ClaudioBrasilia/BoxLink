-- Adiciona raridade aos itens da loja de avatar.
-- Valores: comum | raro | epico | lendario (default: comum para itens já existentes).

alter table public.items
  add column if not exists rarity text not null default 'comum';

alter table public.items
  drop constraint if exists items_rarity_check;

alter table public.items
  add constraint items_rarity_check
  check (rarity in ('comum', 'raro', 'epico', 'lendario'));
