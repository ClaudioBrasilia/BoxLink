-- Corrige os 4 alertas críticos do Security Advisor do Supabase (RLS
-- desligado = tabela 100% pública para qualquer um com a URL do projeto).
-- Nenhuma dessas tabelas guarda dado privado de usuário — são catálogo e
-- configuração já exibidos publicamente (inclusive na TV, que roda sem
-- login), então a leitura continua aberta; só a escrita passa a exigir
-- admin, mesmo padrão já usado em box_join_requests.

alter table public.challenges enable row level security;

do $$ begin
  create policy "Anyone can view challenges"
    on public.challenges for select
    using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Admins can manage challenges"
    on public.challenges for all
    using ((select role from public.profiles where id = auth.uid()) = 'admin')
    with check ((select role from public.profiles where id = auth.uid()) = 'admin');
exception when duplicate_object then null; end $$;

alter table public.items enable row level security;

do $$ begin
  create policy "Anyone can view items"
    on public.items for select
    using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Admins can manage items"
    on public.items for all
    using ((select role from public.profiles where id = auth.uid()) = 'admin')
    with check ((select role from public.profiles where id = auth.uid()) = 'admin');
exception when duplicate_object then null; end $$;

alter table public.avatar_economy_settings enable row level security;

do $$ begin
  create policy "Anyone can view avatar economy settings"
    on public.avatar_economy_settings for select
    using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Admins can manage avatar economy settings"
    on public.avatar_economy_settings for all
    using ((select role from public.profiles where id = auth.uid()) = 'admin')
    with check ((select role from public.profiles where id = auth.uid()) = 'admin');
exception when duplicate_object then null; end $$;

-- View SECURITY DEFINER: hoje roda com o privilégio de quem criou a view
-- (ignora o RLS de quem consulta). Ninguém no app consulta esta view — não
-- muda comportamento visível. security_invoker faz ela respeitar o RLS de
-- quem está consultando, em vez de ignorar.
alter view public.wellhub_checkins_by_class set (security_invoker = true);
