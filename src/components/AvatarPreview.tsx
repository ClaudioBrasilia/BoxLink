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
  
  // Normaliza o nome do arquivo (remove espaços e garante .png)
  const cleanKey = filename.toLowerCase().trim().replace(/\s+/g, '_');
  const path = cleanKey.endsWith('.png') ? cleanKey : `${cleanKey}.png`;
  
  try {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  } catch (e) {
    console.error("Erro ao buscar URL do avatar:", e);
    return '';
  }
}

const BLOCK_POSITIONS: Record<string, { top: string; height: string }> = {
  base:            { top: '0%',      height: '100%'  },
  special:         { top: '0%',      height: '100%'  },
  bottom:          { top: '45%',     height: '55%'   },
  top:             { top: '15%',     height: '45%'   },
  shoes:           { top: '80%',     height: '20%'   },
  hair:            { top: '0%',      height: '35%'   },
  accessory:       { top: '10%',     height: '15%'   },
};

const LAYER_ORDER: Array<keyof AvatarSlot | 'base'> = [
  'base',
  'bottom',
  'shoes',
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
                   equipped?.base_outfit?.toLowerCase() === 'feminina';

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
    layers.push({ key: slot, url: getUrl(value as string), pos, value: value as string });
  }

  const handleImageError = (key: string) => {
    setImageErrors(prev => ({ ...prev, [key]: true }));
  };

  return (
    <div
      className={cn(
        "relative rounded-full overflow-hidden bg-surface-container-low border-2 border-primary/20",
        sizeClasses[size],
        className
      )}
    >
      {/* Sistema de Fallback (SVG) caso a imagem do Supabase falhe */}
      <svg viewBox="0 0 200 300" className="absolute inset-0 w-full h-full text-primary/10">
        {layers.map(({ key, value }) => {
          if (key === 'base') return isFemale ? AvatarLayers.base.female : AvatarLayers.base.male;
          const slotLayers = (AvatarLayers as any)[key];
          if (slotLayers && slotLayers[value]) {
            return typeof slotLayers[value] === 'function' 
              ? slotLayers[value]('currentColor') 
              : slotLayers[value];
          }
          return null;
        })}
      </svg>

      {/* Camadas de Imagem Reais */}
      {layers.map(({ key, url, pos }) => {
        if (imageErrors[key]) return null;
        
        return (
          <img
            key={key}
            src={url}
            alt={key}
            className="absolute left-0 w-full h-full object-contain object-top"
            style={{ top: pos.top, height: pos.height }}
            onError={() => handleImageError(key)}
          />
        );
      })}
    </div>
  );
}
