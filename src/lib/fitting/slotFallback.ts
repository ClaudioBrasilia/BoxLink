/**
 * src/lib/fitting/slotFallback.ts
 * Resolve qual especificação de encaixe (pieceSpecs) usar para uma camada
 * na hora de RENDERIZAR o avatar.
 *
 * Regra:
 * 1. Se o item tem `piece_spec_id` cadastrado (Admin → "Tipo de peça"),
 *    ele vence sempre.
 * 2. Sem spec explícita, usa um fallback genérico por slot — assim itens
 *    antigos (enviados antes do sistema de encaixe, ou sem tipo definido)
 *    ainda são posicionados na zona anatômica correta em vez de ficarem
 *    centralizados no meio do canvas.
 * 3. Slots ambíguos (accessory, special) não têm fallback: podem ser
 *    qualquer coisa (joelheira, óculos, efeito...), então é mais seguro
 *    manter o comportamento atual do que chutar a zona errada.
 *
 * Módulo puro (sem DOM) para ser testável isoladamente.
 */

import { PIECE_SPECS, AvatarBaseId } from './pieceSpecs';

/** Slots de renderização do avatar (mesmos de AvatarSlotKey, sem dependência circular) */
export type RenderSlotKey =
  | 'top'
  | 'bottom'
  | 'shoes'
  | 'accessory'
  | 'wrist_accessory'
  | 'head_accessory'
  | 'special';

/**
 * Proporção (altura/largura) do conteúdo acima da qual um item do slot
 * `bottom` é tratado como calça (senão, short). Short ocupa ~350×240 px
 * (aspecto ≈ 0,7) e calça ~350×710 px (aspecto ≈ 2,0) nas artes de
 * referência, então 1,2 separa bem os dois casos.
 */
export const BOTTOM_PANTS_ASPECT_THRESHOLD = 1.2;

const SLOT_FALLBACK: Record<AvatarBaseId, Partial<Record<RenderSlotKey, string>>> = {
  masculina: {
    top: 'M-01',             // Camiseta
    shoes: 'M-10',           // Tênis
    head_accessory: 'M-06',  // Boné
    wrist_accessory: 'M-07', // Munhequeira
  },
  feminina: {
    top: 'F-01',
    shoes: 'F-10',
    head_accessory: 'F-06',
    wrist_accessory: 'F-07',
  },
};

const BOTTOM_FALLBACK: Record<AvatarBaseId, { short: string; pants: string }> = {
  masculina: { short: 'M-04', pants: 'M-05' },
  feminina: { short: 'F-04', pants: 'F-05' },
};

/**
 * Decide a spec de encaixe para uma camada renderizada.
 *
 * @param slot            Slot do item no avatar
 * @param avatarBase      Base equipada ('masculina' | 'feminina')
 * @param explicitSpecId  `piece_spec_id` do item no banco, quando cadastrado
 * @param contentAspect   Proporção altura/largura do conteúdo opaco detectado
 *                        na imagem (usada só para desambiguar short × calça)
 * @returns id de PIECE_SPECS ou null quando a camada não deve ser reencaixada
 */
export function resolveRenderSpecId(
  slot: RenderSlotKey,
  avatarBase: AvatarBaseId,
  explicitSpecId?: string | null,
  contentAspect?: number | null
): string | null {
  if (explicitSpecId && PIECE_SPECS[explicitSpecId]) return explicitSpecId;

  if (slot === 'bottom') {
    if (contentAspect == null || !isFinite(contentAspect) || contentAspect <= 0) return null;
    const { short, pants } = BOTTOM_FALLBACK[avatarBase];
    return contentAspect > BOTTOM_PANTS_ASPECT_THRESHOLD ? pants : short;
  }

  return SLOT_FALLBACK[avatarBase][slot] ?? null;
}
