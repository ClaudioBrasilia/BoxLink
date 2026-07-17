// Raridade dos itens da loja de avatar.
// Módulo único compartilhado entre o Admin (cadastro/preço) e a loja (etiqueta visual).

export type Rarity = 'comum' | 'raro' | 'epico' | 'lendario';

export const RARITIES: Rarity[] = ['comum', 'raro', 'epico', 'lendario'];

export const RARITY_LABELS: Record<Rarity, string> = {
  comum: 'Comum',
  raro: 'Raro',
  epico: 'Épico',
  lendario: 'Lendário',
};

export const RARITY_EMOJI: Record<Rarity, string> = {
  comum: '🟢',
  raro: '🔵',
  epico: '🟣',
  lendario: '🟠',
};

// Classes Tailwind (texto + fundo + borda) para a etiqueta de raridade nos cards.
export const RARITY_BADGE_CLASS: Record<Rarity, string> = {
  comum: 'text-green-400 bg-green-500/15 border-green-500/30',
  raro: 'text-blue-400 bg-blue-500/15 border-blue-500/30',
  epico: 'text-purple-400 bg-purple-500/15 border-purple-500/30',
  lendario: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
};

// Matriz de preços sugeridos (BrazaCoins) por slot × raridade.
// Usada para pré-preencher o campo Preço no Admin; o admin pode ajustar depois.
export const SLOT_RARITY_PRICE: Record<string, Record<Rarity, number>> = {
  top:             { comum: 80,  raro: 250,  epico: 500,  lendario: 1000 },
  bottom:          { comum: 80,  raro: 250,  epico: 500,  lendario: 1000 },
  shoes:           { comum: 120, raro: 350,  epico: 700,  lendario: 1200 },
  accessory:       { comum: 60,  raro: 180,  epico: 400,  lendario: 900  },
  head_accessory:  { comum: 60,  raro: 180,  epico: 400,  lendario: 900  },
  wrist_accessory: { comum: 60,  raro: 150,  epico: 350,  lendario: 800  },
  special:         { comum: 800, raro: 1000, epico: 1250, lendario: 1500 },
};

// Preço sugerido para um slot/raridade, com fallback seguro.
export function getSlotPrice(slot: string, rarity: Rarity): number {
  return SLOT_RARITY_PRICE[slot]?.[rarity] ?? SLOT_RARITY_PRICE.top[rarity];
}

// Normaliza um valor vindo do banco (pode ser null/legado) para uma Rarity válida.
export function normalizeRarity(value: unknown): Rarity {
  return RARITIES.includes(value as Rarity) ? (value as Rarity) : 'comum';
}
