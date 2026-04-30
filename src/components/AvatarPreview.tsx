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

// Monta a URL pública do Supabase Storage.
// O nome do arquivo pode ter espaços — encodeURIComponent cuida disso.
function getAvatarImageUrl(filename: string): string {
  const encoded = encodeURIComponent(filename);
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${encoded}.png`;
}

// Retorna as camadas de imagem em ordem de renderização.
// base → calça → camiseta → tênis → acessórios
function getAvatarLayers(equipped: AvatarSlot): Array<{ url: string; alt: string }> {
  const isFemale = equipped.base_outfit === 'base_feminina';

  const layers: Array<{ url: string; alt: string }> = [];

  // 1. Base (sempre presente) — nome exato dos arquivos no Storage
  const baseFile = isFemale ? 'base feminina' : 'base masculina';
  layers.push({ url: getAvatarImageUrl(baseFile), alt: 'Base' });

  // 2. Calça
  if (equipped.bottom) {
    layers.push({ url: getAvatarImageUrl(equipped.bottom), alt: 'Calça' });
  }

  // 3. Camiseta
  if (equipped.top) {
    layers.push({ url: getAvatarImageUrl(equipped.top), alt: 'Camiseta' });
  }

  // 4. Tênis
  if (equipped.shoes) {
    layers.push({ url: getAvatarImageUrl(equipped.shoes), alt: 'Tênis' });
  }

  // 5. Especial
  if (equipped.special) {
    layers.push({ url: getAvatarImageUrl(equipped.special), alt: 'Especial' });
  }

  // 6. Acessório de pulso
  if (equipped.wrist_accessory) {
    layers.push({ url: getAvatarImageUrl(equipped.wrist_accessory), alt: 'Pulso' });
  }

  // 7. Acessório de cabeça
  if (equipped.head_accessory) {
    layers.push({ url: getAvatarImageUrl(equipped.head_accessory), alt: 'Cabeça' });
  }

  // 8. Acessório geral
  if (equipped.accessory) {
    layers.push({ url: getAvatarImageUrl(equipped.accessory), alt: 'Acessório' });
  }

  return layers;
}

export default function AvatarPreview({ equipped, className, size = 'md' }: AvatarPreviewProps) {
  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-24 h-24',
    lg: 'w-32 h-32',
    xl: 'w-48 h-48',
  };

  const layers = getAvatarLayers(equipped);
  const isFemale = equipped.base_outfit === 'base_feminina';
  const fallbackBase = getAvatarImageUrl(isFemale ? 'base feminina' : 'base masculina');

  return (
    <div className={cn(
      'relative rounded-full bg-surface-container-highest flex items-center justify-center overflow-hidden border-4 border-primary shadow-[0_0_30px_rgba(202,253,0,0.2)]',
      sizeClasses[size],
      className
    )}>
      {layers.map((layer, index) => (
        <img
          key={index}
          src={layer.url}
          alt={layer.alt}
          className="absolute w-full h-full object-cover object-top"
          onError={(e) => {
            if (index === 0) {
              if (e.currentTarget.src !== fallbackBase) {
                e.currentTarget.src = fallbackBase;
              }
            } else {
              e.currentTarget.style.display = 'none';
            }
          }}
        />
      ))}
    </div>
  );
}
