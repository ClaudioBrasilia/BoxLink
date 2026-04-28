/**
 * Utilitário para compartilhamento em redes sociais
 */

export interface ShareOptions {
  title: string;
  text: string;
  url?: string;
}

/**
 * Compartilhar no WhatsApp
 */
export const shareToWhatsApp = (options: ShareOptions) => {
  const { title, text, url } = options;
  const message = encodeURIComponent(`${title}\n\n${text}${url ? `\n\n${url}` : ''}`);
  const whatsappUrl = `https://wa.me/?text=${message}`;
  window.open(whatsappUrl, '_blank');
};

/**
 * Compartilhar no Instagram (abre a app ou web)
 * Nota: Instagram não permite compartilhamento direto via URL, então abrimos a app
 */
export const shareToInstagram = (imageUrl?: string) => {
  if (imageUrl) {
    // Tenta abrir a app do Instagram
    const instagramUrl = `instagram://library?AssetPath=${imageUrl}`;
    window.open(instagramUrl, '_blank');
    
    // Fallback para web se a app não estiver instalada
    setTimeout(() => {
      window.open('https://www.instagram.com/', '_blank');
    }, 1000);
  } else {
    // Se não houver imagem, apenas abre o Instagram
    window.open('https://www.instagram.com/', '_blank');
  }
};

/**
 * Compartilhar usando Web Share API (se disponível)
 */
export const shareViaWebAPI = async (options: ShareOptions) => {
  if (navigator.share) {
    try {
      await navigator.share({
        title: options.title,
        text: options.text,
        url: options.url || window.location.href,
      });
    } catch (err) {
      console.error('Erro ao compartilhar:', err);
    }
  } else {
    // Fallback para WhatsApp se Web Share API não estiver disponível
    shareToWhatsApp(options);
  }
};

/**
 * Gerar URL de compartilhamento do app
 */
export const getAppShareUrl = (): string => {
  const baseUrl = window.location.origin;
  return baseUrl;
};

/**
 * Gerar mensagem de compartilhamento do app
 */
export const getAppShareMessage = (): string => {
  return `🏋️ Junte-se a mim no BoxLink! 💪\n\nAcompanhe seus treinos, participe de duelos com apostas, ganhe XP e suba no ranking!\n\nBaixe agora e comece sua jornada fitness!`;
};

/**
 * Copiar para clipboard
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Erro ao copiar para clipboard:', err);
    return false;
  }
};
