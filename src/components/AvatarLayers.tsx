import type { AvatarSlot } from '../types';

export type AvatarSlotKey = keyof Omit<AvatarSlot, 'base_outfit'>;

export interface LayerAdjustment {
  scaleX: number;
  scaleY: number;
  offsetX: number;
  offsetY: number;
  transformOrigin: string;
  zIndex: number;
  objectFit: 'contain' | 'cover' | 'fill';
  objectPosition: string;
}

export const SLOT_DEFAULTS: Record<AvatarSlotKey, LayerAdjustment> = {
  bottom:          { scaleX:1, scaleY:1, offsetX:0, offsetY:0, transformOrigin:'bottom center', zIndex:2, objectFit:'contain', objectPosition:'bottom center' },
  shoes:           { scaleX:1, scaleY:1, offsetX:0, offsetY:0, transformOrigin:'bottom center', zIndex:3, objectFit:'contain', objectPosition:'bottom center' },
  top:             { scaleX:1, scaleY:1, offsetX:0, offsetY:0, transformOrigin:'top center',    zIndex:4, objectFit:'contain', objectPosition:'top center'    },
  accessory:       { scaleX:1, scaleY:1, offsetX:0, offsetY:0, transformOrigin:'center center', zIndex:5, objectFit:'contain', objectPosition:'center center' },
  wrist_accessory: { scaleX:1, scaleY:1, offsetX:0, offsetY:0, transformOrigin:'center center', zIndex:6, objectFit:'contain', objectPosition:'center center' },
  head_accessory:  { scaleX:1, scaleY:1, offsetX:0, offsetY:0, transformOrigin:'top center',    zIndex:7, objectFit:'contain', objectPosition:'top center'    },
  special:         { scaleX:1, scaleY:1, offsetX:0, offsetY:0, transformOrigin:'center center', zIndex:8, objectFit:'contain', objectPosition:'center center' },
};

export function resolveAdjustment(slot: AvatarSlotKey, override?: Partial<LayerAdjustment> | null): LayerAdjustment {
  return { ...SLOT_DEFAULTS[slot], ...(override || {}) };
}

export function adjustmentToCSS(adj: LayerAdjustment): React.CSSProperties {
  return {
    position: 'absolute', inset: 0, width: '100%', height: '100%',
    objectFit: adj.objectFit,
    objectPosition: adj.objectPosition,
    transformOrigin: adj.transformOrigin,
    transform: `translate(${adj.offsetX}%, ${adj.offsetY}%) scale(${adj.scaleX}, ${adj.scaleY})`,
    zIndex: adj.zIndex,
    pointerEvents: 'none',
  };
}

export interface ResolvedLayer {
  url: string; alt: string; slot: AvatarSlotKey | 'base'; adjustment: LayerAdjustment;
}

export function buildAvatarLayers(
  equipped: AvatarSlot,
  getUrl: (f: string) => string,
  itemAdjustments?: Record<string, Partial<LayerAdjustment>>
): ResolvedLayer[] {
  const isFemale = equipped.base_outfit === 'base_feminina';
  const layers: ResolvedLayer[] = [];

  layers.push({
    url: getUrl(isFemale ? 'base feminina' : 'base masculina'),
    alt: 'Base', slot: 'base',
    adjustment: { scaleX:1, scaleY:1, offsetX:0, offsetY:0, transformOrigin:'center center', zIndex:0, objectFit:'contain', objectPosition:'center center' },
  });

  const order: Array<{ key: AvatarSlotKey; alt: string }> = [
    { key:'bottom',          alt:'Calça'     },
    { key:'shoes',           alt:'Tênis'     },
    { key:'top',             alt:'Camiseta'  },
    { key:'accessory',       alt:'Acessório' },
    { key:'wrist_accessory', alt:'Pulso'     },
    { key:'head_accessory',  alt:'Cabeça'    },
    { key:'special',         alt:'Especial'  },
  ];

  for (const { key, alt } of order) {
    const itemId = equipped[key];
    if (!itemId) continue;
    layers.push({
      url: getUrl(itemId), alt, slot: key,
      adjustment: resolveAdjustment(key, itemAdjustments?.[itemId] ?? null),
    });
  }
  return layers;
}
