-- Intensidade (esforço) por atleta no duelo.
-- Guarda o % da FC máxima de cada participante ({ [userId]: pct }).
-- Usado no cálculo justo do vencedor: 70% desempenho + 30% esforço,
-- e o esforço só pesa quando TODOS os participantes registraram a FC.

ALTER TABLE duels
  ADD COLUMN IF NOT EXISTS intensity jsonb NOT NULL DEFAULT '{}'::jsonb;
