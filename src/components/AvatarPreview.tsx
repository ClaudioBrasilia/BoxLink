import React from 'react';
import { AvatarSlot } from '../types';
import { cn } from '../lib/utils';

interface AvatarPreviewProps {
  equipped: AvatarSlot;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const BUCKET = 'avatar-assets';

function getUrl(filename: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${encodeURIComponent(filename)}.png`;
}

/**
 * Sistema de blocos (layered sprites).
 * 
 * Cada peça é um PNG do tamanho exato do seu bloco, posicionado
 * com `absolute` + `top` percentual sobre o container do avatar.
 * 
 * Blocos (em % do canvas 1024x1536):
 *   base          top=0%      height=100%   (personagem completo)
 *   head_accessory top=1.56%  height=17.32% (boné, faixa)
 *   top            top=15.62% height=36.46% (camiseta, top esportivo)
 *   bottom         top=47.27% height=24.35% (short, legging)
 *   shoes          top=85.35% height=11.46% (tênis)
 *   wrist_accessory top=40%   height=20%    (relógio, pulseira)
 *   accessory      top=10%    height=15%    (colar, óculos)
 *   special        top=0%     height=100%   (skin completo)
 */
const BLOCK_POSITIONS: Record<string, { top: string; height: string }> = {
  base:            { top: '0%',      height: '100%'  },
  special:         { top: '0%',      height: '100%'  },
  head_accessory:  { top: '1.56%',   height: '17.32%' },
  top:             { top: '15.62%',  height: '36.46%' },
  bottom:          { top: '47.27%',  height: '24.35%' },
  shoes:           { top: '85.35%',  height: '11.46%' },
  wrist_accessory: { top: '40%',     height: '20%'   },
  accessory:       { top: '10%',     height: '15%'   },
};

// Ordem de renderização (de baixo para cima)
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

export default function AvatarPreview({ equipped, className, size = 'md' }: AvatarPreviewProps) {
  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-24 h-24',
    lg: 'w-32 h-32',
    xl: 'w-48 h-48',
  };

  const isFemale = equipped?.base_outfit === 'base_female' ||
    equipped?.base_outfit?.includes('female');
  const baseImage = isFemale ? 'base_feminina' : 'base_masculina';

  // Monta as camadas a renderizar
  const layers: Array<{ key: string; url: string; pos: typeof BLOCK_POSITIONS[string] }> = [];

  for (const slot of LAYER_ORDER) {
    if (slot === 'base') {
      layers.push({
        key: 'base',
        url: getUrl(baseImage),
        pos: BLOCK_POSITIONS.base,
      });
      continue;
    }

    const value = equipped?.[slot as keyof AvatarSlot];
    if (!value) continue;

    const pos = BLOCK_POSITIONS[slot] ?? BLOCK_POSITIONS.base;
    layers.push({ key: slot, url: getUrl(value), pos });
  }

  return (
    <div
      className={cn(
        'relative rounded-full overflow-hidden border-4 border-primary shadow-[0_0_30px_rgba(202,253,0,0.2)] bg-surface-container-highest',
        sizeClasses[size],
        className
      )}
    >
      {layers.map(({ key, url, pos }) => (
        <img
          key={key}
          src={url}
          alt={key}
          className="absolute left-0 w-full object-cover object-top"
          style={{ top: pos.top, height: pos.height }}
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      ))}
    </div>
  );
}
