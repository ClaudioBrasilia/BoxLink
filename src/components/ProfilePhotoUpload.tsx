// src/components/ProfilePhotoUpload.tsx
// Componente de upload de foto de rosto do atleta
// Aparece no Profile — foto circular clicável para trocar

import React, { useState, useRef } from 'react';
import { Camera, Loader2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

interface ProfilePhotoUploadProps {
  userId: string;
  currentPhotoUrl: string | null;
  onPhotoUpdated: (newUrl: string | null) => void;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE = {
  sm: 'w-16 h-16',
  md: 'w-24 h-24',
  lg: 'w-28 h-28',
};

const TEXT_SIZE = {
  sm: 'text-xl',
  md: 'text-3xl',
  lg: 'text-4xl',
};

export default function ProfilePhotoUpload({
  userId,
  currentPhotoUrl,
  onPhotoUpdated,
  size = 'lg',
}: ProfilePhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentPhotoUrl);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validações
    if (!file.type.startsWith('image/')) {
      setError('Selecione uma imagem (JPG, PNG, etc.)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Imagem muito grande. Máximo 5MB.');
      return;
    }

    setError(null);
    setUploading(true);

    try {
      // Preview imediato
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target?.result as string);
      reader.readAsDataURL(file);

      // Upload para o Supabase Storage
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${userId}/photo.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      // Pega a URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(path);

      // Adiciona timestamp para forçar atualização do cache
      const urlWithCache = `${publicUrl}?t=${Date.now()}`;

      // Salva no perfil
      await supabase.from('profiles')
        .update({ photo_url: urlWithCache })
        .eq('id', userId);

      setPreview(urlWithCache);
      onPhotoUpdated(urlWithCache);
    } catch (err: any) {
      console.error('[ProfilePhoto] Erro:', err);
      setError('Erro ao fazer upload. Tente novamente.');
      setPreview(currentPhotoUrl);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    if (!preview) return;
    setUploading(true);
    try {
      await supabase.from('profiles').update({ photo_url: null }).eq('id', userId);
      // Tenta deletar do storage
      await supabase.storage.from('profile-photos').remove([`${userId}/photo.jpg`, `${userId}/photo.png`, `${userId}/photo.jpeg`]);
      setPreview(null);
      onPhotoUpdated(null);
    } catch (err) {
      console.error('[ProfilePhoto] Erro ao remover:', err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative group">
        {/* Foto ou inicial */}
        <div className={cn(
          'rounded-full overflow-hidden border-4 border-primary shadow-[0_0_20px_rgba(202,253,0,0.3)] bg-surface-container-highest flex items-center justify-center cursor-pointer',
          SIZE[size]
        )}
          onClick={() => !uploading && inputRef.current?.click()}>
          {uploading ? (
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          ) : preview ? (
            <img src={preview} alt="Foto de perfil" className="w-full h-full object-cover" />
          ) : (
            <span className={cn('font-headline font-black text-primary', TEXT_SIZE[size])}>
              📷
            </span>
          )}

          {/* Overlay ao hover */}
          {!uploading && (
            <div className="absolute inset-0 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Camera className="w-6 h-6 text-white" />
            </div>
          )}
        </div>

        {/* Botão remover foto */}
        {preview && !uploading && (
          <button onClick={handleRemove}
            className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow">
            <X className="w-3 h-3 text-white" />
          </button>
        )}
      </div>

      <p className="text-[9px] text-on-surface-variant font-bold uppercase tracking-widest">
        {uploading ? 'Enviando...' : 'Clique para adicionar foto'}
      </p>

      {error && (
        <p className="text-red-400 text-[9px] font-bold uppercase tracking-widest text-center">{error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
