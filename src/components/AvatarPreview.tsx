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
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${filename}.png`;
}

/**
 * Resolve qual imagem mostrar com base nos itens equipados.
 * Prioridade: item equipado > base do gênero
 *
 * Como cada imagem PNG já contém o personagem completo vestido com aquele item,
 * mostramos apenas UMA imagem por vez — a do item de maior prioridade visual.
 * Ordem de prioridade: top > bottom > shoes > especial > base
 */
function resolveAvatarImage(equipped: AvatarSlot): string {
  // Determina gênero pela base
  const isFemale = equipped.base_outfit === 'base_female' || equipped.base_outfit?.includes('female');

  // Prioridade: top > bottom > shoes > special > base
  if (equipped.top) return getAvatarImageUrl(equipped.top);
  if (equipped.bottom) return getAvatarImageUrl(equipped.bottom);
  if (equipped.shoes) return getAvatarImageUrl(equipped.shoes);
  if (equipped.special) return getAvatarImageUrl(equipped.special);

  // Fallback: imagem base do gênero
  const baseImage = isFemale ? 'base_feminina' : 'base_masculina';
  return getAvatarImageUrl(baseImage);
}

export default function AvatarPreview({ equipped, className, size = 'md' }: AvatarPreviewProps) {
  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-24 h-24',
    lg: 'w-32 h-32',
    xl: 'w-48 h-48',
  };

  const imageUrl = resolveAvatarImage(equipped);

  return (
    <div className={cn(
      'relative rounded-full bg-surface-container-highest flex items-center justify-center overflow-hidden border-4 border-primary shadow-[0_0_30px_rgba(202,253,0,0.2)]',
      sizeClasses[size],
      className
    )}>
      <img
        src={imageUrl}
        alt="Avatar"
        className="w-full h-full object-cover object-top"
        onError={(e) => {
          // Fallback para base se a imagem do item não carregar
          const isFemale = equipped.base_outfit?.includes('female');
          const fallback = getAvatarImageUrl(isFemale ? 'base_feminina' : 'base_masculina');
          if (e.currentTarget.src !== fallback) {
            e.currentTarget.src = fallback;
          }
        }}
      />
    </div>
  );
}
