// src/components/AthleteComparisonCard.tsx
// Card de comparação de desempenho entre 2+ atletas — mesma linguagem visual
// dos gráficos de análise do CrossFit Games (URQ Analytics): nome dos atletas
// no topo, uma linha por métrica com os valores lado a lado, e o melhor
// resultado de cada linha destacado.
// Usado em: Duelos (resultado final), Ranking do WOD (comparação avulsa).

import type { LucideIcon } from 'lucide-react';
import { Crown } from 'lucide-react';
import { cn } from '../lib/utils';
import AthletePhoto from './AthletePhoto';

export interface ComparisonParticipant {
  id: string;
  name: string;
  photoUrl?: string | null;
  isWinner?: boolean;
}

export interface ComparisonRow {
  key: string;
  icon: LucideIcon;
  label: string;
  /** participantId -> valor já formatado para exibição */
  values: Record<string, string>;
  /** id do participante com o melhor valor nesta linha (null = empate/sem destaque) */
  bestParticipantId?: string | null;
}

interface AthleteComparisonCardProps {
  participants: ComparisonParticipant[];
  rows: ComparisonRow[];
  /** Mostra a linha de cabeçalho com foto + nome de cada participante (padrão: true) */
  showHeader?: boolean;
  /** Frase de destaque final, ex.: "Vantagem de João: mais rápido e mais forte" */
  edge?: string;
  className?: string;
}

export default function AthleteComparisonCard({
  participants,
  rows,
  showHeader = true,
  edge,
  className,
}: AthleteComparisonCardProps) {
  const n = participants.length;
  const gridStyle = { gridTemplateColumns: `1.3fr repeat(${n}, 1fr)` };

  return (
    <div className={cn('bg-surface-container-highest/30 rounded-2xl border border-outline-variant/10 overflow-hidden flex flex-col', className)}>
      {showHeader && (
        <div className="grid gap-2 px-4 py-3 border-b border-outline-variant/10" style={gridStyle}>
          <div />
          {participants.map(p => (
            <div key={p.id} className="flex flex-col items-center gap-1 min-w-0">
              <AthletePhoto photoUrl={p.photoUrl} name={p.name} size="sm"
                ringColor={p.isWinner ? 'border-primary' : 'border-outline-variant/20'} />
              <span className={cn('text-[10px] font-black uppercase italic truncate max-w-full',
                p.isWinner ? 'text-primary' : 'text-on-surface')}>
                {p.name} {p.isWinner && '🏆'}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col divide-y divide-outline-variant/5">
        {rows.map(row => (
          <div key={row.key} className="grid gap-2 px-4 py-3 items-center" style={gridStyle}>
            <div className="flex items-center gap-2 min-w-0">
              <row.icon className="w-3.5 h-3.5 text-secondary shrink-0" />
              <span className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest truncate">{row.label}</span>
            </div>
            {participants.map(p => {
              const isBest = row.bestParticipantId != null && row.bestParticipantId === p.id;
              return (
                <div key={p.id} className={cn('flex items-center justify-center gap-1 font-headline font-black italic text-sm tabular-nums',
                  isBest ? 'text-primary' : 'text-on-surface')}>
                  {row.values[p.id] ?? '—'}
                  {isBest && <Crown className="w-3 h-3 shrink-0" />}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {edge && (
        <div className="bg-primary/10 border-t border-primary/20 px-4 py-2.5 text-center">
          <span className="text-primary text-[10px] font-black uppercase italic tracking-wide">{edge}</span>
        </div>
      )}
    </div>
  );
}
