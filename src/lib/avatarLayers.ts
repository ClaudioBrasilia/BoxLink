/**
 * src/lib/avatarLayers.ts
 * Fonte única de verdade para camadas do avatar.
 * Canvas de referência: 1024×1536 (proporção 2:3).
 */

import React from 'react';
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

/**
 * Defaults por slot — todos usam contain + center center,
 * idêntico à base, para que as zonas do mapa 1024×1536 sejam consistentes.
 */
export const SLOT_DEFAULTS: Record<AvatarSlotKey, LayerAdjustment> = {
  bottom:          { scaleX:1, scaleY:1, offsetX:0, offsetY:0, transformOrigin:'center center', zIndex:2, objectFit:'contain', objectPosition:'center center' },
  shoes:           { scaleX:1, scaleY:1, offsetX:0, offsetY:0, transformOrigin:'center center', zIndex:3, objectFit:'contain', objectPosition:'center center' },
  top:             { scaleX:1, scaleY:1, offsetX:0, offsetY:0, transformOrigin:'center center', zIndex:4, objectFit:'contain', objectPosition:'center center' },
  accessory:       { scaleX:1, scaleY:1, offsetX:0, offsetY:0, transformOrigin:'center center', zIndex:5, objectFit:'contain', objectPosition:'center center' },
  wrist_accessory: { scaleX:1, scaleY:1, offsetX:0, offsetY:0, transformOrigin:'center center', zIndex:6, objectFit:'contain', objectPosition:'center center' },
  head_accessory:  { scaleX:1, scaleY:1, offsetX:0, offsetY:0, transformOrigin:'center center', zIndex:7, objectFit:'contain', objectPosition:'center center' },
  special:         { scaleX:1, scaleY:1, offsetX:0, offsetY:0, transformOrigin:'center center', zIndex:8, objectFit:'contain', objectPosition:'center center' },
};

export function resolveAdjustment(
  slot: AvatarSlotKey,
  override?: Partial<LayerAdjustment> | null
): LayerAdjustment {
  return { ...SLOT_DEFAULTS[slot], ...(override || {}) };
}

/** Converte LayerAdjustment em CSSProperties aplicável a uma <img> */
export function adjustmentToCSS(adj: LayerAdjustment): React.CSSProperties {
  return {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: adj.objectFit,
    objectPosition: adj.objectPosition,
    transformOrigin: adj.transformOrigin,
    transform: `translate(${adj.offsetX}%, ${adj.offsetY}%) scale(${adj.scaleX}, ${adj.scaleY})`,
    zIndex: adj.zIndex,
    pointerEvents: 'none',
  };
}

export interface ResolvedLayer {
  url: string;
  alt: string;
  slot: AvatarSlotKey | 'base';
  adjustment: LayerAdjustment;
  /** ID do item equipado (ausente na camada base) */
  itemId?: string;
}

/**
 * Monta todas as camadas do avatar em ordem de renderização.
 * A base agora usa objectFit:'contain' + 'center center' — mesmo sistema
 * das roupas — para que as zonas do mapa 1024×1536 coincidam perfeitamente.
 */
export function buildAvatarLayers(
  equipped: AvatarSlot,
  getUrl: (filename: string) => string,
  itemAdjustments?: Record<string, Partial<LayerAdjustment>>
): ResolvedLayer[] {
  const isFemale = equipped.base_outfit === 'base_feminina';
  const layers: ResolvedLayer[] = [];

  // — Camada base — usa contain + center center (igual às roupas) —
  const baseFile = isFemale ? 'base feminina' : 'base masculina';
  layers.push({
    url: getUrl(baseFile),
    alt: 'Base',
    slot: 'base',
    adjustment: {
      scaleX: 1,
      scaleY: 1,
      offsetX: 0,
      offsetY: 0,
      transformOrigin: 'center center',
      zIndex: 0,
      objectFit: 'contain',           // ← antes era 'cover'
      objectPosition: 'center center', // ← antes era 'top center'
    },
  });

  const slotOrder: Array<{ key: AvatarSlotKey; alt: string }> = [
    { key: 'bottom',          alt: 'Calça' },
    { key: 'shoes',           alt: 'Tênis' },
    { key: 'top',             alt: 'Camiseta' },
    { key: 'accessory',       alt: 'Acessório' },
    { key: 'wrist_accessory', alt: 'Pulso' },
    { key: 'head_accessory',  alt: 'Cabeça' },
    { key: 'special',         alt: 'Especial' },
  ];

  for (const { key, alt } of slotOrder) {
    const itemId = equipped[key];
    if (!itemId) continue;
    const override = itemAdjustments?.[itemId] ?? null;
    layers.push({
      url: getUrl(itemId),
      alt,
      slot: key,
      adjustment: resolveAdjustment(key, override),
      itemId,
    });
  }

  return layers;
}
