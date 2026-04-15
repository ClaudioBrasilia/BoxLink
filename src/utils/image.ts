
import { supabase } from '../lib/supabase';

/**
 * Comprime uma imagem no frontend antes do upload.
 * @param file O arquivo de imagem original.
 * @param maxWidth Largura máxima da imagem.
 * @param maxHeight Altura máxima da imagem.
 * @param quality Qualidade da compressão (0 a 1).
 * @returns Uma Promise que resolve com o Blob da imagem comprimida.
 */
export const compressImage = (
  file: File,
  maxWidth: number = 800,
  maxHeight: number = 800,
  quality: number = 0.7
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Erro ao comprimir imagem.'));
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

/**
 * Faz o upload de uma imagem para o Supabase Storage com compressão prévia.
 * @param file O arquivo de imagem original.
 * @param bucket O nome do bucket no Supabase Storage.
 * @param path O caminho/nome do arquivo no bucket.
 * @returns Uma Promise que resolve com a URL pública da imagem.
 */
export const uploadImage = async (
  file: File,
  bucket: string,
  path: string
): Promise<string> => {
  try {
    // Comprimir a imagem antes do upload
    const compressedBlob = await compressImage(file);
    
    // Upload para o Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, compressedBlob, {
        upsert: true,
        contentType: 'image/jpeg'
      });

    if (error) throw error;

    // Obter a URL pública
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return publicUrl;
  } catch (error) {
    console.error('Erro no upload da imagem:', error);
    throw error;
  }
};
