/**
 * Utilitário para gerar imagens do ranking para compartilhamento
 */

import { User as UserType } from '../types';

export interface RankingImageOptions {
  title: string;
  top3: UserType[];
  rankingType: 'xp' | 'freq' | 'clans';
  boxName?: string;
}

/**
 * Gerar uma imagem do ranking em formato canvas
 */
export const generateRankingImage = async (options: RankingImageOptions): Promise<string> => {
  const { title, top3, rankingType, boxName = 'BoxLink' } = options;

  // Criar canvas
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível obter contexto do canvas');

  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#1a1a1a');
  gradient.addColorStop(1, '#2d2d2d');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Título
  ctx.font = 'bold 60px Arial';
  ctx.fillStyle = '#CAFD00';
  ctx.textAlign = 'center';
  ctx.fillText('🏆 RANKING 🏆', canvas.width / 2, 100);

  // Subtítulo
  ctx.font = '32px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(title, canvas.width / 2, 160);

  // Box Name
  ctx.font = '24px Arial';
  ctx.fillStyle = '#999999';
  ctx.fillText(boxName, canvas.width / 2, 210);

  // Desenhar Top 3
  const positions = [
    { x: canvas.width / 2 - 200, y: 400, medal: '🥈', rank: '2º' },
    { x: canvas.width / 2, y: 300, medal: '🥇', rank: '1º' },
    { x: canvas.width / 2 + 200, y: 400, medal: '🥉', rank: '3º' },
  ];

  top3.forEach((user, index) => {
    const pos = positions[index];

    // Círculo de fundo
    ctx.fillStyle = index === 0 ? '#CAFD00' : '#666666';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y - 100, 80, 0, Math.PI * 2);
    ctx.fill();

    // Medal emoji
    ctx.font = 'bold 80px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(pos.medal, pos.x, pos.y - 80);

    // Nome
    ctx.font = 'bold 28px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(user.name.split(' ')[0], pos.x, pos.y + 80);

    // Pontuação
    ctx.font = '24px Arial';
    ctx.fillStyle = '#CAFD00';
    let scoreText = '';
    if (rankingType === 'xp') {
      scoreText = `${user.xp} XP`;
    } else if (rankingType === 'freq') {
      scoreText = `${user.monthCheckinCount || 0} Check-ins`;
    } else {
      scoreText = `${user.level} Nível`;
    }
    ctx.fillText(scoreText, pos.x, pos.y + 120);

    // Nível
    ctx.font = '20px Arial';
    ctx.fillStyle = '#999999';
    ctx.fillText(`Nível ${user.level}`, pos.x, pos.y + 160);
  });

  // Footer
  ctx.font = '20px Arial';
  ctx.fillStyle = '#666666';
  ctx.textAlign = 'center';
  ctx.fillText('Compartilhado do BoxLink 💪', canvas.width / 2, canvas.height - 50);

  // Converter para data URL
  return canvas.toDataURL('image/png');
};

/**
 * Download da imagem
 */
export const downloadRankingImage = (imageUrl: string, filename: string = 'ranking.png') => {
  const link = document.createElement('a');
  link.href = imageUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Compartilhar imagem via WhatsApp
 */
export const shareRankingToWhatsApp = (imageUrl: string, title: string) => {
  const text = encodeURIComponent(`🏆 ${title}\n\nVeja meu ranking no BoxLink!\n\n`);
  // WhatsApp não permite compartilhamento direto de imagens via URL, então compartilhamos o link
  const whatsappUrl = `https://wa.me/?text=${text}`;
  window.open(whatsappUrl, '_blank');
};

/**
 * Copiar imagem para clipboard (se suportado)
 */
export const copyImageToClipboard = async (imageUrl: string): Promise<boolean> => {
  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    
    if (navigator.clipboard && navigator.clipboard.write) {
      const item = new ClipboardItem({ 'image/png': blob });
      await navigator.clipboard.write([item]);
      return true;
    }
    return false;
  } catch (err) {
    console.error('Erro ao copiar imagem:', err);
    return false;
  }
};
