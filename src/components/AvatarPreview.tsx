import React from 'react';
import { AvatarSlot } from '../types';
import { cn } from '../lib/utils';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const BUCKET = 'avatar-assets';

function getUrl(filename: string): string {
  if (!filename || !SUPABASE_URL) return '';
  const clean = filename.trim().toLowerCase().replace(/\s+/g, '_');
  const withExt = /\.(png|jpe?g|webp|gif|svg)$/i.test(clean) ? clean : `${clean}.png`;
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${encodeURIComponent(withExt)}`;
}

/**
 * Sistema de blocos (layered sprites) — canvas 1024×1536
 *
 * Cada peça é um PNG posicionado com top/height percentuais
 * sobre o container, mostrando o personagem de corpo inteiro.
 *
 *   base             top=0%      height=100%
 *   head_accessory   top=1.56%   height=17.32%
 *   top              top=15.62%  height=36.46%
 *   bottom           top=47.27%  height=24.35%
 *   shoes            top=85.35%  height=11.46%
 *   wrist_accessory  top=40%     height=20%
 *   accessory        top=10%     height=15%
 *   special          top=0%      height=100%
 */
const BLOCK_POSITIONS: Record<string, { top: string; height: string }> = {
  base:            { top: '0%',     height: '100%'   },
  special:         { top: '0%',     height: '100%'   },
  head_accessory:  { top: '1.56%',  height: '17.32%' },
  top:             { top: '15.62%', height: '36.46%' },
  bottom:          { top: '47.27%', height: '24.35%' },
  shoes:           { top: '85.35%', height: '11.46%' },
  wrist_accessory: { top: '40%',    height: '20%'    },
  accessory:       { top: '10%',    height: '15%'    },
};

const LAYER_ORDER: Array<keyof AvatarSlot | 'base'> = [
  'base',
  'bottom',
  'shoes',
  'top',
  'wrist_accessory',
  'accessory',
  'head_accessory',
  'special',
];

interface AvatarPreviewProps {
  equipped: AvatarSlot;
  // items prop accepted but not used — new system reads filenames directly from equipped
  items?: any[];
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  overrideSlot?: { slot: keyof AvatarSlot; itemId: string | null };
}

const sizeClasses: Record<NonNullable<AvatarPreviewProps['size']>, string> = {
  sm: 'w-12 h-12',
  md: 'w-24 h-24',
  lg: 'w-32 h-32',
  xl: 'w-48 h-48',
};

export default function AvatarPreview({
  equipped,
  size = 'md',
  className,
  overrideSlot,
}: AvatarPreviewProps) {
  const resolvedEquipped: AvatarSlot = {
    ...(equipped || ({} as AvatarSlot)),
    ...(overrideSlot ? { [overrideSlot.slot]: overrideSlot.itemId } : {}),
  } as AvatarSlot;

  const isFemale =
    resolvedEquipped?.base_outfit === 'base_female' ||
    resolvedEquipped?.base_outfit?.includes('female') ||
    resolvedEquipped?.base_outfit?.toLowerCase?.().includes('feminina');

  const baseFilename = isFemale ? 'base feminina' : 'base masculina';

  const layers: Array<{ key: string; url: string; pos: { top: string; height: string } }> = [];

  for (const slot of LAYER_ORDER) {
    if (slot === 'base') {
      layers.push({ key: 'base', url: getUrl(baseFilename), pos: BLOCK_POSITIONS.base });
      continue;
    }
    const value = resolvedEquipped?.[slot as keyof AvatarSlot];
    if (!value) continue;
    const pos = BLOCK_POSITIONS[slot] ?? BLOCK_POSITIONS.base;
    layers.push({ key: slot, url: getUrl(value as string), pos });
  }

  return (
    <div
      className={cn(
        'relative rounded-full overflow-hidden border-4 border-primary shadow-[0_0_30px_rgba(202,253,0,0.3)] bg-surface-container-highest',
        sizeClasses[size],
        className
      )}
    >
      {layers.map(({ key, url, pos }) => (
        <img
          key={key}
          src={url}
          alt={key}
          draggable={false}
          className="absolute left-0 w-full object-cover object-top select-none pointer-events-none"
          style={{ top: pos.top, height: pos.height }}
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      ))}
    </div>
  );
}

// Keep legacy exports so AvatarCustomization doesn't break
export function getItemImageUrl(key: string) { return getUrl(key); }
export function getBaseImageUrl(equipped: AvatarSlot) {
  const isFemale = equipped?.base_outfit?.includes('female') || equipped?.base_outfit?.toLowerCase?.().includes('feminina');
  return getUrl(isFemale ? 'base feminina' : 'base masculina');
}
