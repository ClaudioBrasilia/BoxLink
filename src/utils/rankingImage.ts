/**
 * Utilitário para gerar imagens do ranking para compartilhamento
 */

import { User as UserType } from '../types';
import { supabase } from '../lib/supabase';

export interface RankingImageOptions {
  title: string;
  top3: UserType[];
  rankingType: 'xp' | 'freq' | 'clans';
  boxName?: string;
}

/**
 * Carregar uma imagem a partir de uma URL
 */
const loadImage = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = url;
  });
};

/**
 * Gerar uma imagem do ranking em formato canvas
 */
export const generateRankingImage = async (options: RankingImageOptions): Promise<string> => {
  const { title, top3, rankingType } = options;

  // Buscar configurações do Box para pegar a logo e o nome real
  const { data: settings } = await supabase.from('box_settings').select('name, logo').maybeSingle();
  const boxName = settings?.name || options.boxName || 'BoxLink';
  const logoUrl = settings?.logo;

  // Criar canvas
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível obter contexto do canvas');

  // Background transparente com overlay sutil
  // Fundo transparente — ideal para postar sobre fotos ou fundo personalizado
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Overlay dark semi-transparente para legibilidade
  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Borda decorativa verde
  ctx.strokeStyle = 'rgba(202, 253, 0, 0.3)';
  ctx.lineWidth = 8;
  ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

  // Linhas decorativas sutis
  ctx.strokeStyle = 'rgba(202, 253, 0, 0.05)';
  ctx.lineWidth = 1;
  for (let i = 0; i < canvas.width; i += 80) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, canvas.height);
    ctx.stroke();
  }

  // Logo do Box (se existir)
  if (logoUrl) {
    try {
      const logoImg = await loadImage(logoUrl);
      const logoSize = 180;
      const logoX = (canvas.width - logoSize) / 2;
      const logoY = 80;
      
      // Desenhar logo com sombra
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 20;
      ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
      ctx.shadowBlur = 0;
    } catch (err) {
      console.error('Erro ao carregar logo:', err);
    }
  }

  // Título do Ranking
  ctx.font = 'black 80px Arial';
  ctx.fillStyle = '#CAFD00';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('RANKING', canvas.width / 2, 350);

  // Subtítulo (Tipo de Ranking)
  ctx.font = 'bold 40px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(title.toUpperCase(), canvas.width / 2, 420);

  // Nome do Box
  ctx.font = 'italic bold 30px Arial';
  ctx.fillStyle = '#999999';
  ctx.fillText(boxName.toUpperCase(), canvas.width / 2, 470);

  // Desenhar Podium
  const podiumY = 950;
  const positions = [
    { x: canvas.width / 2 - 300, y: podiumY + 50, medal: '🥈', rank: '2º', color: '#C0C0C0', height: 300 },
    { x: canvas.width / 2, y: podiumY, medal: '🥇', rank: '1º', color: '#CAFD00', height: 450 },
    { x: canvas.width / 2 + 300, y: podiumY + 100, medal: '🥉', rank: '3º', color: '#CD7F32', height: 200 },
  ];

  // Desenhar bases do podium
  positions.forEach((pos, index) => {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.beginPath();
    ctx.roundRect(pos.x - 130, pos.y, 260, pos.height, 20);
    ctx.fill();
    ctx.strokeStyle = pos.color + '44';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Número da posição no podium
    ctx.font = 'bold 120px Arial';
    ctx.fillStyle = pos.color + '22';
    ctx.fillText(pos.rank[0], pos.x, pos.y + 150);
  });

  // Desenhar Atletas
  top3.forEach((user, index) => {
    const pos = positions[index];
    const avatarY = pos.y - 120;

    // Círculo do Avatar
    ctx.beginPath();
    ctx.arc(pos.x, avatarY, 90, 0, Math.PI * 2);
    ctx.fillStyle = '#222222';
    ctx.fill();
    ctx.strokeStyle = pos.color;
    ctx.lineWidth = 5;
    ctx.stroke();

    // Medalha
    ctx.font = '60px Arial';
    ctx.fillText(pos.medal, pos.x, avatarY - 100);

    // Nome do Atleta
    ctx.font = 'bold 36px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(user.name.split(' ')[0].toUpperCase(), pos.x, pos.y - 240);

    // Pontuação
    ctx.font = 'bold 32px Arial';
    ctx.fillStyle = pos.color;
    let scoreText = '';
    if (rankingType === 'xp') {
      scoreText = `${user.xp} XP`;
    } else if (rankingType === 'freq') {
      scoreText = `${user.monthCheckinCount || 0} CHECK-INS`;
    } else {
      scoreText = `LVL ${user.level}`;
    }
    ctx.fillText(scoreText, pos.x, pos.y - 200);
  });

  // Footer
  ctx.font = 'bold 24px Arial';
  ctx.fillStyle = '#444444';
  ctx.textAlign = 'center';
  ctx.fillText('GERADO POR BOXLINK • ARENA DE PERFORMANCE', canvas.width / 2, canvas.height - 60);

  // Converter para data URL
  return canvas.toDataURL('image/png', 1.0); // PNG mantém transparência
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
  const text = encodeURIComponent(`🏆 *RANKING ${title.toUpperCase()}*\n\nConfira o pódio do nosso Box no BoxLink! 💪🔥\n\n`);
  const whatsappUrl = `https://wa.me/?text=${text}`;
  window.open(whatsappUrl, '_blank');
};

/**
 * Copiar imagem para clipboard
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
