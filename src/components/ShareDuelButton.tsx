import { Share2 } from 'lucide-react';
import { computeDuelEdge, DuelScoreOutcome } from '../lib/duelScore';

interface ShareDuelParticipant {
  id: string;
  name: string;
}

interface ShareDuelButtonProps {
  wodName?: string;
  wodType?: string;
  outcome: DuelScoreOutcome;
  participants: ShareDuelParticipant[];
  results: Record<string, string | null>;
}

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

async function generateDuelRecapImage(
  wodName: string,
  wodType: string,
  outcome: DuelScoreOutcome,
  participants: ShareDuelParticipant[],
  results: Record<string, string | null>,
): Promise<Blob> {
  const { winnerId, usedIntensity, entries } = outcome;
  const edge = computeDuelEdge(outcome, participants.map(p => p.id));
  const winnerName = winnerId ? participants.find(p => p.id === winnerId)?.name.split(' ')[0] : null;

  const W = 1080;
  const ROW_H = 150;
  const TABLE_TOP = 560;
  const rows = participants.length;
  const footerLines = edge ? 2 + edge.insights.length : 1;
  const H = TABLE_TOP + rows * ROW_H + 120 + footerLines * 48 + 260;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Fundo
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0a0a0a');
  bg.addColorStop(0.5, '#111111');
  bg.addColorStop(1, '#0d0d0d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, 700);
  glow.addColorStop(0, 'rgba(202,253,0,0.16)');
  glow.addColorStop(1, 'rgba(202,253,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Cabeçalho
  ctx.textAlign = 'center';
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.letterSpacing = '5px';
  ctx.fillText('DUELO FINALIZADO', W / 2, 100);
  ctx.letterSpacing = '0px';

  ctx.font = 'bold 56px system-ui, sans-serif';
  ctx.fillStyle = '#cafd00';
  const title = winnerName ? `${winnerName} LEVOU A MELHOR` : 'DUELO EMPATADO';
  ctx.fillText(title, W / 2, 175);

  ctx.font = '32px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  const subtitle = wodType ? `${wodName} • ${wodType}` : wodName;
  ctx.fillText(subtitle, W / 2, 225);

  ctx.strokeStyle = 'rgba(202,253,0,0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(120, 270);
  ctx.lineTo(W - 120, 270);
  ctx.stroke();

  // Cabeçalho da tabela
  const cols = ['ATLETA', 'RESULTADO', 'DESEMP.', ...(usedIntensity ? ['ESFORÇO'] : []), 'PLACAR'];
  const colX = [140, 430, 620, ...(usedIntensity ? [800] : []), W - 140];
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  cols.forEach((c, i) => {
    ctx.textAlign = i === 0 ? 'left' : (i === cols.length - 1 ? 'right' : 'center');
    ctx.fillText(c, colX[i], TABLE_TOP);
  });

  // Linhas por atleta (vencedor primeiro)
  const sorted = [...participants].sort((a, b) => (entries[b.id]?.total ?? 0) - (entries[a.id]?.total ?? 0));
  sorted.forEach((p, i) => {
    const y = TABLE_TOP + 50 + i * ROW_H;
    const isWinner = p.id === winnerId;

    if (isWinner) {
      ctx.fillStyle = 'rgba(202,253,0,0.07)';
      const r = 24;
      const rx = 100, rw = W - 200, ry = y - 60, rh = ROW_H - 24;
      ctx.beginPath();
      ctx.moveTo(rx + r, ry);
      ctx.arcTo(rx + rw, ry, rx + rw, ry + rh, r);
      ctx.arcTo(rx + rw, ry + rh, rx, ry + rh, r);
      ctx.arcTo(rx, ry + rh, rx, ry, r);
      ctx.arcTo(rx, ry, rx + rw, ry, r);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(202,253,0,0.35)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    const entry = entries[p.id];
    const values = [
      (isWinner ? '🏆 ' : '') + p.name.split(' ')[0].toUpperCase(),
      results[p.id] || '—',
      entry ? String(entry.perf) : '—',
      ...(usedIntensity ? [entry?.effort != null ? `${entry.effort}%` : '—'] : []),
      entry ? String(entry.total) : '—',
    ];

    values.forEach((v, ci) => {
      ctx.textAlign = ci === 0 ? 'left' : (ci === values.length - 1 ? 'right' : 'center');
      ctx.font = ci === values.length - 1 ? 'bold 40px system-ui, sans-serif' : (ci === 0 ? 'bold 34px system-ui, sans-serif' : '34px system-ui, sans-serif');
      ctx.fillStyle = isWinner ? (ci === values.length - 1 ? '#cafd00' : '#ffffff') : 'rgba(255,255,255,0.7)';
      ctx.fillText(v, colX[ci], y);
    });
  });

  // Rodapé — por que venceu
  let footerY = TABLE_TOP + 50 + rows * ROW_H + 60;
  if (edge) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 28px system-ui, sans-serif';
    ctx.fillStyle = '#cafd00';
    const summaryLines = wrapText(ctx, `A VANTAGEM DE ${winnerName?.toUpperCase()}: ${edge.summary.toUpperCase()}`, W - 240);
    summaryLines.forEach(line => { ctx.fillText(line, W / 2, footerY); footerY += 40; });
    footerY += 10;

    ctx.font = '26px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    edge.insights.forEach(ins => {
      ctx.fillText(ins.text, W / 2, footerY);
      footerY += 42;
    });
  }

  // Marca
  const brandY = H - 90;
  ctx.strokeStyle = 'rgba(202,253,0,0.2)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(180, brandY - 40);
  ctx.lineTo(W - 180, brandY - 40);
  ctx.stroke();

  ctx.font = 'bold 32px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.letterSpacing = '4px';
  ctx.fillText('BOXLINK APP', W / 2, brandY);
  ctx.letterSpacing = '0px';

  return new Promise(resolve => canvas.toBlob(b => resolve(b!), 'image/png', 1));
}

export default function ShareDuelButton({ wodName, wodType, outcome, participants, results }: ShareDuelButtonProps) {
  const handleShare = async () => {
    let blob: Blob;
    try {
      blob = await generateDuelRecapImage(wodName || 'Duelo', wodType || '', outcome, participants, results);
    } catch (err) {
      console.error('Erro ao gerar imagem do duelo:', err);
      return;
    }

    const file = new File([blob], 'duelo-resumo.png', { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'Resumo do Duelo',
          text: `⚔️ Confira o resumo do duelo — ${wodName || 'BoxLink'}!`,
        });
        return;
      } catch {
        // usuário cancelou ou falhou — faz download
      }
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `duelo-resumo-${Date.now()}.png`;
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
