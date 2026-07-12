-- Desacopla o ID/nome livre do item da loja do "tipo de peça" usado pelo
-- sistema de encaixe automático (src/lib/fitting). O admin agora escolhe o
-- tipo de peça (ex.: "M-01" / Camiseta Masculina) num menu separado do ID
-- do item, que pode ser qualquer texto livre.
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS piece_spec_id TEXT;

COMMENT ON COLUMN public.items.piece_spec_id IS
  'Chave da especificação de encaixe em src/lib/fitting/pieceSpecs.ts (ex.: "M-01", "F-05"). NULL = sem encaixe automático (centraliza a imagem manualmente).';
