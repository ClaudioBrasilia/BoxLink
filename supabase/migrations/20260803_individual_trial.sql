-- ─────────────────────────────────────────────────────────────────────────────
-- Trial automático de Premium no cadastro (BoxLink Individual)
--
-- Toda conta individual nasce com 30 dias de Premium, sem precisar de
-- concessão manual no Admin. Vence sozinho — isPremium() no app já respeita
-- plan_expires_at, então nenhuma mudança de código foi necessária além desta
-- migration.
--
-- Conta de box não usa o conceito de plano (sempre vê tudo), por isso o
-- trial só se aplica a account_type = 'individual'.
--
-- Para mudar a duração do trial, ajuste o INTERVAL abaixo.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_account_type text := COALESCE(new.raw_user_meta_data->>'account_type', 'box');
  v_trial_expires timestamptz;
BEGIN
  IF v_account_type NOT IN ('box', 'individual') THEN
    v_account_type := 'box';
  END IF;

  IF v_account_type = 'individual' THEN
    v_trial_expires := now() + interval '30 days';
  END IF;

  INSERT INTO public.profiles (id, name, email, role, status, account_type, plan, plan_expires_at)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', 'Novo Atleta'),
    new.email,
    'athlete',
    -- Conta individual entra liberada; aluno de box aguarda aprovação do admin.
    -- Admin é atribuído manualmente (SQL) ou por outro admin no painel — nunca no cadastro.
    CASE WHEN v_account_type = 'individual' THEN 'approved' ELSE 'pending' END,
    v_account_type,
    CASE WHEN v_account_type = 'individual' THEN 'premium' ELSE 'free' END,
    v_trial_expires
  );

  -- Registra o trial em plan_grants (mesmo histórico usado pelas concessões
  -- manuais do Admin), com granted_by nulo para diferenciar de uma concessão
  -- feita por um humano.
  IF v_account_type = 'individual' THEN
    INSERT INTO public.plan_grants (user_id, granted_by, plan, method, expires_at, note)
    VALUES (new.id, NULL, 'premium', 'trial_auto', v_trial_expires, 'Trial automático de cadastro (30 dias)');
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
