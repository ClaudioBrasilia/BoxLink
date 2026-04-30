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

function getAvatarImageUrl(filename: string): string {
  const encoded = encodeURIComponent(filename);
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${encoded}.png`;
}

/**
 * Retorna um array de imagens para renderizar em camadas.
 * A ordem importa: cada camada é renderizada por cima da anterior.
 * Ordem de renderização: base → bottom → top → shoes → acessórios especiais
 */
function getAvatarLayers(equipped: AvatarSlot): Array<{ url: string; alt: string }> {
  // Determina gênero pela base
  const isFemale = equipped.base_outfit === 'base_feminina';

  const layers: Array<{ url: string; alt: string }> = [];

  // 1. Camada base (sempre presente)
  const baseImage = isFemale ? 'base_feminina' : 'base_masculina';
  layers.push({ url: getAvatarImageUrl(baseImage), alt: 'Base' });

  // 2. Calça (bottom)
  if (equipped.bottom) {
    layers.push({ url: getAvatarImageUrl(equipped.bottom), alt: 'Calça' });
  }

  // 3. Camiseta (top)
  if (equipped.top) {
    layers.push({ url: getAvatarImageUrl(equipped.top), alt: 'Camiseta' });
  }

  // 4. Sapatos (shoes)
  if (equipped.shoes) {
    layers.push({ url: getAvatarImageUrl(equipped.shoes), alt: 'Sapatos' });
  }

  // 5. Acessórios especiais
  if (equipped.special) {
    layers.push({ url: getAvatarImageUrl(equipped.special), alt: 'Acessório Especial' });
  }

  // 6. Acessórios de pulso
  if (equipped.wrist_accessory) {
    layers.push({ url: getAvatarImageUrl(equipped.wrist_accessory), alt: 'Acessório de Pulso' });
  }

  // 7. Acessórios de cabeça
  if (equipped.head_accessory) {
    layers.push({ url: getAvatarImageUrl(equipped.head_accessory), alt: 'Acessório de Cabeça' });
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

  return (
    <div className={cn(
      'relative rounded-full bg-surface-container-highest flex items-center justify-center overflow-hidden border-4 border-primary shadow-[0_0_30px_rgba(202,253,0,0.2)]',
      sizeClasses[size],
      className
    )}>
      {/* Renderizar todas as camadas em ordem */}
      {layers.map((layer, index) => (
        <img
          key={index}
          src={layer.url}
          alt={layer.alt}
          className="absolute w-full h-full object-cover object-top"
          onError={(e) => {
            // Fallback para base se a imagem não carregar
            const fallback = getAvatarImageUrl(isFemale ? 'base_feminina' : 'base_masculina');
            if (e.currentTarget.src !== fallback && index === 0) {
              // Apenas substituir a imagem base se ela não carregar
              e.currentTarget.src = fallback;
            } else if (index > 0) {
              // Para outras camadas, simplesmente remover se não carregar
              e.currentTarget.style.display = 'none';
            }
          }}
        />
      ))}
    </div>
  );
}
