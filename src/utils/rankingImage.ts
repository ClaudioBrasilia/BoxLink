/**
 * Utilitário para gerar imagens do ranking para compartilhamento
 * Tamanho compacto (1080x1080) com fundo transparente — ideal para sobrepor foto do aluno
 */

import { User as UserType } from '../types';
import { supabase } from '../lib/supabase';

export interface RankingImageOptions {
  title: string;
  top3: UserType[];
  rankingType: 'xp' | 'freq' | 'clans';
  boxName?: string;
}

const loadImage = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = url;
  });
};

const drawTextShadow = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  shadowColor = 'rgba(0,0,0,0.9)',
  blur = 12,
) => {
  ctx.shadowColor = shadowColor;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;
  ctx.fillText(text, x, y);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
};

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  r: number | [number, number, number, number] = 0,
) {
  const [tl, tr, br, bl] = Array.isArray(r) ? r : [r, r, r, r];
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  ctx.arcTo(x + w, y, x + w, y + tr, tr);
  ctx.lineTo(x + w, y + h - br);
  ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
  ctx.lineTo(x + bl, y + h);
  ctx.arcTo(x, y + h, x, y + h - bl, bl);
  ctx.lineTo(x, y + tl);
  ctx.arcTo(x, y, x + tl, y, tl);
  ctx.closePath();
}

const drawInitials = (ctx: CanvasRenderingContext2D, name: string, cx: number, cy: number, r: number) => {
  const initials = name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
  ctx.font = `bold ${Math.round(r * 0.85)}px Arial`;
  ctx.fillStyle = '#CAFD00';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initials, cx, cy);
};

const drawAvatar = async (
  ctx: CanvasRenderingContext2D,
  user: UserType,
  cx: number, cy: number, radius: number,
  borderColor: string,
) => {
  ctx.save();
  ctx.shadowColor = borderColor;
  ctx.shadowBlur = 22;
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 6, 0, Math.PI * 2);
  ctx.fillStyle = borderColor;
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(15, 15, 15, 0.96)';
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();

  const avatarUrl = (user as any).avatar_url || (user as any).photoUrl || null;
  if (avatarUrl) {
    try {
      const img = await loadImage(avatarUrl);
      ctx.drawImage(img, cx - radius, cy - radius, radius * 2, radius * 2);
    } catch {
      drawInitials(ctx, user.name, cx, cy, radius);
    }
  } else {
    drawInitials(ctx, user.name, cx, cy, radius);
  }
  ctx.restore();
};

export const generateRankingImage = async (options: RankingImageOptions): Promise<string> => {
  const { title, top3, rankingType } = options;

  const { data: settings } = await supabase.from('box_settings').select('name, logo').maybeSingle();
  const boxName = settings?.name || options.boxName || 'BoxLink';
  const logoUrl = settings?.logo;

  const W = 1080;
  const H = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  if (!ctx) throw new Error('Não foi possível obter contexto do canvas');

  // FUNDO TRANSPARENTE
  ctx.clearRect(0, 0, W, H);

  // PAINEL GLASS CARD
  const pad = 36;
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, 'rgba(0,0,0,0.84)');
  bgGrad.addColorStop(0.4, 'rgba(0,0,0,0.56)');
  bgGrad.addColorStop(0.6, 'rgba(0,0,0,0.56)');
  bgGrad.addColorStop(1, 'rgba(0,0,0,0.90)');
  ctx.fillStyle = bgGrad;
  roundRect(ctx, pad, pad, W - pad * 2, H - pad * 2, 44);
  ctx.fill();

  // BORDA NEON
  ctx.save();
  ctx.shadowColor = '#CAFD00';
  ctx.shadowBlur = 28;
  ctx.strokeStyle = '#CAFD00';
  ctx.lineWidth = 3;
  roundRect(ctx, pad, pad, W - pad * 2, H - pad * 2, 44);
  ctx.stroke();
  ctx.restore();

  // GRADE SUTIL
  ctx.save();
  ctx.strokeStyle = 'rgba(202,253,0,0.035)';
  ctx.lineWidth = 1;
  for (let x = pad; x < W - pad; x += 54) {
    ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, H - pad); ctx.stroke();
  }
  ctx.restore();

  // CABEÇALHO
  let headerY = 118;

  if (logoUrl) {
    try {
      const logoImg = await loadImage(logoUrl);
      const ls = 88;
      ctx.beginPath();
      ctx.arc(W / 2, headerY, ls / 2 + 10, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fill();
      ctx.drawImage(logoImg, W / 2 - ls / 2, headerY - ls / 2, ls, ls);
      headerY += 64;
    } catch { /* ignora */ }
  }

  ctx.font = 'bold 26px Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  drawTextShadow(ctx, boxName.toUpperCase(), W / 2, headerY, 'rgba(0,0,0,0.8)', 10);
  headerY += 42;

  // Linhas decorativas
  ctx.save();
  ctx.strokeStyle = 'rgba(202,253,0,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pad + 50, headerY); ctx.lineTo(W / 2 - 100, headerY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W / 2 + 100, headerY); ctx.lineTo(W - pad - 50, headerY); ctx.stroke();
  ctx.restore();

  // Título
  ctx.font = '900 64px Arial';
  ctx.fillStyle = '#CAFD00';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  drawTextShadow(ctx, '🏆 RANKING', W / 2, headerY + 18, 'rgba(0,0,0,0.9)', 24);
  headerY += 52;

  ctx.font = 'bold 32px Arial';
  ctx.fillStyle = '#ffffff';
  drawTextShadow(ctx, title.toUpperCase(), W / 2, headerY + 4, 'rgba(0,0,0,0.8)', 14);
  headerY += 50;

  // PÓDIO
  const podiumBaseY = H - 148;
  const bw = 228;
  const gap = 18;
  const cx = W / 2;

  const slots = [
    { x: cx - bw - gap, rank: 1, color: '#C0C0C0', medal: '🥈', label: '2º', bh: 250 },
    { x: cx,            rank: 0, color: '#CAFD00', medal: '🥇', label: '1º', bh: 330 },
    { x: cx + bw + gap, rank: 2, color: '#CD7F32', medal: '🥉', label: '3º', bh: 170 },
  ];

  // Bases
  slots.forEach((slot) => {
    const bx = slot.x - bw / 2;
    const by = podiumBaseY - slot.bh;

    ctx.save();
    ctx.shadowColor = slot.color + '55';
    ctx.shadowBlur = 16;
    const g = ctx.createLinearGradient(bx, by, bx + bw, by + slot.bh);
    g.addColorStop(0, slot.color + '2A');
    g.addColorStop(1, slot.color + '08');
    ctx.fillStyle = g;
    roundRect(ctx, bx, by, bw, slot.bh, [14, 14, 0, 0]);
    ctx.fill();
    ctx.strokeStyle = slot.color + '70';
    ctx.lineWidth = 2;
    roundRect(ctx, bx, by, bw, slot.bh, [14, 14, 0, 0]);
    ctx.stroke();
    ctx.restore();

    ctx.font = 'bold 118px Arial';
    ctx.fillStyle = slot.color + '12';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(slot.label[0], slot.x, by + slot.bh * 0.52);

    ctx.font = 'bold 26px Arial';
    ctx.fillStyle = slot.color;
    drawTextShadow(ctx, slot.label, slot.x, podiumBaseY - 24, 'rgba(0,0,0,0.8)', 8);
  });

  // Linha base neon
  ctx.save();
  const lg = ctx.createLinearGradient(pad + 50, podiumBaseY, W - pad - 50, podiumBaseY);
  lg.addColorStop(0, 'transparent');
  lg.addColorStop(0.15, '#CAFD00');
  lg.addColorStop(0.85, '#CAFD00');
  lg.addColorStop(1, 'transparent');
  ctx.strokeStyle = lg;
  ctx.lineWidth = 3;
  ctx.shadowColor = '#CAFD00';
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(pad + 50, podiumBaseY);
  ctx.lineTo(W - pad - 50, podiumBaseY);
  ctx.stroke();
  ctx.restore();

  // Atletas
  const aR = 58;
  for (const slot of slots) {
    const user = top3[slot.rank];
    if (!user) continue;

    const avatarCY = podiumBaseY - slot.bh - aR - 28;
    const avatarCX = slot.x;

    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    drawTextShadow(ctx, slot.medal, avatarCX, avatarCY - aR - 38, 'rgba(0,0,0,0.8)', 12);

    await drawAvatar(ctx, user, avatarCX, avatarCY, aR, slot.color);

    const firstName = user.name.split(' ')[0].toUpperCase();
    ctx.font = 'bold 28px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    drawTextShadow(ctx, firstName, avatarCX, avatarCY + aR + 24, 'rgba(0,0,0,0.9)', 12);

    let scoreText = '';
    if (rankingType === 'xp') {
      const xp = (user as any).monthXp ?? user.xp ?? 0;
      scoreText = `${xp} XP`;
    } else if (rankingType === 'freq') {
      scoreText = `${user.monthCheckinCount ?? 0} CHECK-INS`;
    } else {
      scoreText = `LVL ${user.level}`;
    }
    ctx.font = 'bold 22px Arial';
    ctx.fillStyle = slot.color;
    drawTextShadow(ctx, scoreText, avatarCX, avatarCY + aR + 54, 'rgba(0,0,0,0.8)', 8);
  }

  // FOOTER
  ctx.font = '18px Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  drawTextShadow(ctx, 'BOXLINK • ARENA DE PERFORMANCE', W / 2, H - 54, 'rgba(0,0,0,0.7)', 8);

  return canvas.toDataURL('image/png', 1.0);
};

export const downloadRankingImage = (imageUrl: string, filename = 'ranking-boxlink.png') => {
  const a = document.createElement('a');
  a.href = imageUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

export const shareRankingToWhatsApp = (imageUrl: string, title: string) => {
  const text = encodeURIComponent(
    `🏆 *RANKING ${title.toUpperCase()}*\n\nConfira o pódio do nosso Box no BoxLink! 💪🔥\n\n`,
  );
  window.open(`https://wa.me/?text=${text}`, '_blank');
};

export const copyImageToClipboard = async (imageUrl: string): Promise<boolean> => {
  try {
    const blob = await fetch(imageUrl).then((r) => r.blob());
    if (navigator.clipboard?.write) {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      return true;
    }
    return false;
  } catch (err) {
    console.error('Erro ao copiar imagem:', err);
    return false;
  }
};
