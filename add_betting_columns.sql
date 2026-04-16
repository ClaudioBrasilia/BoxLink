-- Adicionar colunas para funcionalidade de apostas na tabela de duelos
ALTER TABLE public.duels 
ADD COLUMN IF NOT EXISTS bet_mode BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS bet_type TEXT DEFAULT 'none',
ADD COLUMN IF NOT EXISTS bet_amount INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS bet_reserved BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS bet_reserved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS bet_settled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS bet_canceled_at TIMESTAMPTZ;

-- Comentários para documentação
COMMENT ON COLUMN public.duels.bet_mode IS 'Indica se o duelo possui uma aposta ativa';
COMMENT ON COLUMN public.duels.bet_type IS 'Tipo da aposta (ex: xp, coins, none)';
COMMENT ON COLUMN public.duels.bet_amount IS 'Valor da aposta por participante';
COMMENT ON COLUMN public.duels.bet_reserved IS 'Indica se o valor da aposta já foi deduzido dos participantes';
