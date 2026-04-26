import React, { useState } from 'react';
import { AvatarSlot } from '../types';
import { cn } from '../lib/utils';
import { AvatarLayers } from './AvatarLayers';
import { supabase } from '../lib/supabase';

interface AvatarPreviewProps {
  equipped: AvatarSlot;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const BUCKET = 'avatar-assets';

function getUrl(filename: string): string {
  if (!filename) return '';
  if (filename.startsWith('http')) return filename;
  
  const cleanKey = filename.toLowerCase().trim().replace(/\s+/g, '_');
  
  // Usar o cliente supabase para obter a URL pública de forma robusta
  try {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(
      cleanKey.endsWith('.png') ? cleanKey : `${cleanKey}.png`
    );
    return data.publicUrl;
  } catch (e) {
    return '';
  }
}

const BLOCK_POSITIONS: Record<string, { top: string; height: string }> = {
  base:            { top: '0%',      height: '100%'  },
  special:         { top: '0%',      height: '100%'  },
  body:            { top: '0%',      height: '100%'  },
  top:             { top: '0%',      height: '60%'   },
  bottom:          { top: '40%',     height: '60%'   },
  hair:            { top: '0%',      height: '40%'   },
  accessory:       { top: '10%',     height: '15%'   },
};

const LAYER_ORDER: Array<keyof AvatarSlot | 'base'> = [
  'base',
  'bottom',
  'top',
  'hair',
  'accessory',
  'special'
];

export default function AvatarPreview({ equipped, className, size = 'md' }: AvatarPreviewProps) {
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-24 h-24',
    lg: 'w-32 h-32',
    xl: 'w-48 h-48',
  };

  const isFemale = equipped?.base_outfit === 'base_female' || 
                   equipped?.base_outfit?.includes('female') ||
                   equipped?.base_outfit?.toLowerCase().includes('feminina');

  const baseImage = isFemale ? 'base_feminina' : 'base_masculina';

  const layers: Array<{ key: string; url: string; pos: typeof BLOCK_POSITIONS[string]; value: string }> = [];

  for (const slot of LAYER_ORDER) {
    if (slot === 'base') {
      layers.push({
        key: 'base',
        url: getUrl(baseImage),
        pos: BLOCK_POSITIONS.base,
        value: isFemale ? 'female' : 'male'
      });
      continue;
    }

    const value = equipped?.[slot as keyof AvatarSlot];
    if (!value) continue;

    const pos = BLOCK_POSITIONS[slot] ?? BLOCK_POSITIONS.base;
    layers.push({ key: slot, url: getUrl(value), pos, value });
  }

  const handleImageError = (key: string) => {
    setImageErrors(prev => ({ ...prev, [key]: true }));
  };

  return (
    <div
      className={cn(
        "relative rounded-full overflow-hidden bg-surface-container-highest",
        sizeClasses[size],
        className
      )}
    >
      {/* SVG Fallback System - Desenhos caso a imagem falhe */}
      <svg viewBox="0 0 200 300" className="absolute inset-0 w-full h-full text-on-surface-variant opacity-20">
        {layers.map(({ key, value }) => {
          if (key === 'base') {
            return isFemale ? AvatarLayers.base.female : AvatarLayers.base.male;
          }
          const slotLayers = (AvatarLayers as any)[key];
          if (slotLayers && slotLayers[value]) {
            return typeof slotLayers[value] === 'function' 
              ? slotLayers[value]('currentColor') 
              : slotLayers[value];
          }
          return null;
        })}
      </svg>

      {/* Image Layers - As imagens reais vindas do Supabase */}
      {layers.map(({ key, url, pos }) => {
        if (imageErrors[key]) return null;
        
        return (
          <img
            key={key}
            src={url}
            alt={key}
            className="absolute left-0 w-full object-contain object-top"
            style={{ top: pos.top, height: pos.height }}
            onError={() => handleImageError(key)}
          />
        );
      })}
    </div>
  );
}
