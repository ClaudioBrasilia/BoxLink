import { Share2, Download } from 'lucide-react';

interface ShareRankingButtonProps {
  top3: Array<{
    name: string;
    xp?: number;
    monthXp?: number;
    monthCheckinCount?: number;
    energy?: number;
  }>;
  rankingType: 'xp' | 'freq' | 'clans';
  title: string;
  boxName?: string;
  boxLogo?: string;
  monthName?: string;
}

// ── Carrega imagem como ImageBitmap (suporta URL externa com CORS) ──
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Falha ao carregar imagem'));
    img.src = src;
  });
}

// ── Quebra texto longo em múltiplas linhas ──
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function generateRankingImage(
  top3: ShareRankingButtonProps['top3'],
  rankingType: ShareRankingButtonProps['rankingType'],
  title: string,
  boxName: string,
  boxLogo: string,
  monthName: string,
): Promise<Blob> {
  // ── Canvas 1080 × 1920 (Stories 9:16) ──
  const W = 1080;
  const H = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // ── Fundo gradiente escuro ──
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0,   '#0a0a0a');
  bg.addColorStop(0.5, '#111111');
  bg.addColorStop(1,   '#0d0d0d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // ── Glow verde no topo ──
  const glow = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, 700);
  glow.addColorStop(0,   'rgba(202,253,0,0.18)');
  glow.addColorStop(1,   'rgba(202,253,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // ── Glow secundário no fundo ──
  const glow2 = ctx.createRadialGradient(W / 2, H, 0, W / 2, H, 600);
  glow2.addColorStop(0,   'rgba(202,253,0,0.08)');
  glow2.addColorStop(1,   'rgba(202,253,0,0)');
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, W, H);

  // ── Grade de pontos decorativa ──
  ctx.fillStyle = 'rgba(255,255,255,0.025)';
  for (let x = 60; x < W; x += 80) {
    for (let y = 60; y < H; y += 80) {
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Logo do box ──
  const LOGO_SIZE = 120;
  const LOGO_Y = 140;
  if (boxLogo) {
    try {
      const logoImg = await loadImage(boxLogo);
      // Círculo branco de fundo
      ctx.save();
      ctx.beginPath();
      ctx.arc(W / 2, LOGO_Y + LOGO_SIZE / 2, LOGO_SIZE / 2 + 8, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fill();
      // Clip circular
      ctx.beginPath();
      ctx.arc(W / 2, LOGO_Y + LOGO_SIZE / 2, LOGO_SIZE / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(logoImg, W / 2 - LOGO_SIZE / 2, LOGO_Y, LOGO_SIZE, LOGO_SIZE);
      ctx.restore();
    } catch {
      // sem logo: círculo placeholder
      ctx.beginPath();
      ctx.arc(W / 2, LOGO_Y + LOGO_SIZE / 2, LOGO_SIZE / 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(202,253,0,0.15)';
      ctx.fill();
    }
  }

  // ── Nome do box ──
  const nameY = LOGO_Y + LOGO_SIZE + 52;
  ctx.textAlign = 'center';
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.letterSpacing = '4px';
  ctx.fillText(boxName.toUpperCase(), W / 2, nameY);
  ctx.letterSpacing = '0px';

  // ── Linha separadora ──
  const sepY = nameY + 48;
  ctx.strokeStyle = 'rgba(202,253,0,0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(180, sepY);
  ctx.lineTo(W - 180, sepY);
  ctx.stroke();

  // ── Título do ranking ──
  const titleY = sepY + 70;
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillStyle = '#cafd00';
  ctx.letterSpacing = '6px';
  ctx.fillText(`🏆 RANKING ${title}`, W / 2, titleY);
  ctx.letterSpacing = '0px';

  // ── Mês ──
  ctx.font = '32px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillText(monthName.toUpperCase(), W / 2, titleY + 52);

  // ── Cards do Top 3 ──
  const medals   = ['🥇', '🥈', '🥉'];
  const positions = ['1º', '2º', '3º'];
  const cardColors = [
    { border: 'rgba(202,253,0,0.6)', bg: 'rgba(202,253,0,0.07)', pos: '#cafd00' },
    { border: 'rgba(255,255,255,0.25)', bg: 'rgba(255,255,255,0.04)', pos: 'rgba(255,255,255,0.7)' },
    { border: 'rgba(255,255,255,0.15)', bg: 'rgba(255,255,255,0.025)', pos: 'rgba(255,255,255,0.5)' },
  ];

  const CARD_W      = 900;
  const CARD_H      = 190;
  const CARD_X      = (W - CARD_W) / 2;
  const CARD_START_Y = titleY + 110;
  const CARD_GAP    = 28;

  const getScore = (u: typeof top3[0]) => {
    if (rankingType === 'xp')   return `${(u.monthXp ?? u.xp ?? 0).toLocaleString('pt-BR')} XP`;
    if (rankingType === 'freq') return `${u.monthCheckinCount ?? 0} check-ins`;
    if (rankingType === 'clans') return `${u.energy ?? 0} ⚡`;
    return '';
  };

  for (let i = 0; i < Math.min(top3.length, 3); i++) {
    const u     = top3[i];
    const color = cardColors[i];
    const cardY = CARD_START_Y + i * (CARD_H + CARD_GAP);
    const radius = 28;

    // Card fundo
    ctx.beginPath();
    ctx.moveTo(CARD_X + radius, cardY);
    ctx.lineTo(CARD_X + CARD_W - radius, cardY);
    ctx.quadraticCurveTo(CARD_X + CARD_W, cardY, CARD_X + CARD_W, cardY + radius);
    ctx.lineTo(CARD_X + CARD_W, cardY + CARD_H - radius);
    ctx.quadraticCurveTo(CARD_X + CARD_W, cardY + CARD_H, CARD_X + CARD_W - radius, cardY + CARD_H);
    ctx.lineTo(CARD_X + radius, cardY + CARD_H);
    ctx.quadraticCurveTo(CARD_X, cardY + CARD_H, CARD_X, cardY + CARD_H - radius);
    ctx.lineTo(CARD_X, cardY + radius);
    ctx.quadraticCurveTo(CARD_X, cardY, CARD_X + radius, cardY);
    ctx.closePath();
    ctx.fillStyle = color.bg;
    ctx.fill();
    ctx.strokeStyle = color.border;
    ctx.lineWidth = i === 0 ? 2.5 : 1.5;
    ctx.stroke();

    // Posição (número grande à esquerda)
    ctx.textAlign = 'left';
    ctx.font = `bold ${i === 0 ? 88 : 72}px system-ui, sans-serif`;
    ctx.fillStyle = color.pos;
    ctx.globalAlpha = i === 0 ? 1 : 0.6;
    ctx.fillText(positions[i], CARD_X + 36, cardY + CARD_H / 2 + (i === 0 ? 30 : 24));
    ctx.globalAlpha = 1;

    // Medal emoji
    ctx.font = `${i === 0 ? 56 : 44}px system-ui, sans-serif`;
    ctx.fillText(medals[i], CARD_X + 148, cardY + CARD_H / 2 + (i === 0 ? 20 : 15));

    // Nome do atleta
    const firstName = u.name.split(' ')[0];
    const lastName  = u.name.split(' ').slice(1).join(' ');
    ctx.textAlign = 'left';
    ctx.font = `bold ${i === 0 ? 52 : 44}px system-ui, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(firstName.toUpperCase(), CARD_X + 250, cardY + (lastName ? CARD_H / 2 - 10 : CARD_H / 2 + 18));
    if (lastName) {
      ctx.font = `${i === 0 ? 36 : 30}px system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillText(lastName.toUpperCase(), CARD_X + 252, cardY + CARD_H / 2 + 34);
    }

    // Score à direita
    ctx.textAlign = 'right';
    ctx.font = `bold ${i === 0 ? 44 : 36}px system-ui, sans-serif`;
    ctx.fillStyle = i === 0 ? '#cafd00' : 'rgba(255,255,255,0.55)';
    ctx.fillText(getScore(u), CARD_X + CARD_W - 36, cardY + CARD_H / 2 + 16);
  }

  // ── Faixa inferior ──
  const footerY = H - 180;
  ctx.strokeStyle = 'rgba(202,253,0,0.2)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(180, footerY);
  ctx.lineTo(W - 180, footerY);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.letterSpacing = '4px';
  ctx.fillText('BOXLINK APP', W / 2, footerY + 56);
  ctx.letterSpacing = '0px';

  ctx.font = '28px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(202,253,0,0.5)';
  ctx.fillText('Gerencie seu box com tecnologia', W / 2, footerY + 100);

  // ── Retorna blob ──
  return new Promise(resolve => canvas.toBlob(b => resolve(b!), 'image/png', 1));
}

export default function ShareRankingButton({
  top3, rankingType, title,
  boxName = 'BoxLink',
  boxLogo = '',
  monthName = '',
}: ShareRankingButtonProps) {
  const handleShare = async () => {
    const month = monthName || new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

    let blob: Blob;
    try {
      blob = await generateRankingImage(top3, rankingType, title, boxName, boxLogo, month);
    } catch (err) {
      console.error('Erro ao gerar imagem:', err);
      return;
    }

    const file = new File([blob], `ranking-${rankingType}.png`, { type: 'image/png' });

    // ── Share nativo (iOS/Android) com arquivo ──
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `Ranking ${title}`,
          text: `🏆 Confira o ranking de ${title} do ${boxName}!`,
        });
        return;
      } catch {
        // usuário cancelou ou falhou — faz download
      }
    }

    // ── Fallback: download direto ──
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = `ranking-${rankingType}-${Date.now()}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  return (
    <button
      onClick={handleShare}
      className="flex items-center gap-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
    >
      <Share2 className="w-3 h-3" />
      COMPARTILHAR
    </button>
  );
}
