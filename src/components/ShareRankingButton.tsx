import { Share2 } from 'lucide-react';

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
}

export default function ShareRankingButton({ top3, rankingType, title }: ShareRankingButtonProps) {
  const handleShare = async () => {
    const getScore = (u: any) => {
      if (rankingType === 'xp') return `${u.monthXp ?? u.xp ?? 0} XP`;
      if (rankingType === 'freq') return `${u.monthCheckinCount ?? 0} check-ins`;
      if (rankingType === 'clans') return `${u.energy ?? 0} ⚡`;
      return '';
    };

    const text = [
      `🏆 RANKING ${title}`,
      '',
      ...top3.map((u, i) => {
        const medals = ['🥇', '🥈', '🥉'];
        return `${medals[i]} ${u.name} — ${getScore(u)}`;
      }),
      '',
      '💪 BoxLink App',
    ].join('\n');

    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch {
        // usuário cancelou
      }
    } else {
      await navigator.clipboard.writeText(text);
      alert('Ranking copiado para a área de transferência!');
    }
  };

  return (
    <button
      onClick={handleShare}
      className="flex items-center gap-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
    >
      <Share2 className="w-3 h-3" />
      COMPARTILHAR
    </button>
  );
}
