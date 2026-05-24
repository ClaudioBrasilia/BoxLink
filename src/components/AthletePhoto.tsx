// src/components/AthletePhoto.tsx
// Exibe a foto de rosto do atleta com fallback para inicial do nome.
// Usado no Ranking (pódio) e na TV.

import React, { useState } from 'react';
import { cn } from '../lib/utils';

interface AthletePhotoProps {
  photoUrl?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  ringColor?: string; // cor da borda ex: 'border-primary'
  fadePercent?: number; // inatividade 0-100
}

const SIZE_CLASSES = {
  sm: 'w-10 h-10 text-base',
  md: 'w-16 h-16 text-2xl',
  lg: 'w-24 h-24 text-3xl',
  xl: 'w-32 h-32 text-4xl',
};

export default function AthletePhoto({
  photoUrl,
  name,
  size = 'md',
  className,
  ringColor = 'border-white/20',
  fadePercent = 0,
}: AthletePhotoProps) {
  const [imgError, setImgError] = useState(false);
  const initial = (name || '?')[0].toUpperCase();

  // Filtro de inatividade
  const fade = Math.min(Math.max(fadePercent, 0), 100);
  const filterStyle = fade > 0
    ? { filter: `saturate(${1 - fade / 100}) brightness(${1 - (fade / 100) * 0.25})` }
    : undefined;

  const showPhoto = photoUrl && !imgError;

  return (
    <div className={cn(
      'rounded-full overflow-hidden border-4 flex items-center justify-center shrink-0 bg-surface-container-highest',
      ringColor,
      SIZE_CLASSES[size],
      className
    )}
      style={filterStyle}>
      {showPhoto ? (
        <img
          src={photoUrl}
          alt={name}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <span className="font-headline font-black text-white leading-none">{initial}</span>
      )}
    </div>
  );
}
