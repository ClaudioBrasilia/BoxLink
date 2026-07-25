-- O "já viu o onboarding" era guardado só no localStorage do navegador/app,
-- que é por dispositivo/instalação — reinstalar o app, trocar de navegador
-- ou abrir uma URL de preview diferente apagava a marcação e o onboarding
-- reaparecia para a mesma conta. Agora fica na conta (profiles), então
-- persiste em qualquer dispositivo.

alter table public.profiles
  add column if not exists onboarding_done boolean not null default false;

-- Contas já existentes provavelmente já viram o onboarding antes (via
-- localStorage) — não precisam ver de novo. Só contas novas a partir daqui
-- começam com onboarding_done = false.
update public.profiles set onboarding_done = true where onboarding_done = false;
