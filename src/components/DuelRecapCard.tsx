import { computeDuelEdge, DuelScoreOutcome } from '../lib/duelScore';
import { cn } from '../lib/utils';

interface RecapParticipant {
  id: string;
  name: string;
}

interface DuelRecapCardProps {
  wodName?: string;
  wodType?: string;
  outcome: DuelScoreOutcome;
  participants: RecapParticipant[];
  results: Record<string, string | null>;
}

export default function DuelRecapCard({ wodName, wodType, outcome, participants, results }: DuelRecapCardProps) {
  const { winnerId, usedIntensity, entries } = outcome;
  const edge = computeDuelEdge(outcome, participants.map(p => p.id));
  const winnerName = winnerId ? participants.find(p => p.id === winnerId)?.name.split(' ')[0] : null;

  return (
    <div className="bg-surface-container-highest/40 rounded-2xl border border-outline-variant/10 overflow-hidden">
      {/* Cabeçalho */}
      <div className="px-4 pt-4 pb-3 flex flex-col gap-0.5">
        <p className="text-[9px] font-black text-on-surface-variant/60 uppercase tracking-widest">
          {wodName}{wodType ? ` • ${wodType}` : ''}
        </p>
        <h3 className="font-headline font-black italic text-lg uppercase bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          {winnerName ? `${winnerName} levou a melhor` : 'Duelo empatado'}
        </h3>
      </div>

      {/* Tabela comparativa */}
      <div
        className="px-4 pb-3 grid gap-y-1 gap-x-2 items-center"
        style={{ gridTemplateColumns: `auto repeat(${participants.length}, minmax(0,1fr))` }}
      >
        <div />
        {participants.map(p => (
          <div
            key={p.id}
            className={cn(
              'text-center text-[9px] font-black uppercase tracking-widest truncate pb-1',
              p.id === winnerId ? 'text-primary' : 'text-on-surface-variant'
            )}
          >
            {p.id === winnerId ? `🏆 ${p.name.split(' ')[0]}` : p.name.split(' ')[0]}
          </div>
        ))}

        <RecapRow
          label="Resultado"
          participants={participants}
          winnerId={winnerId}
          getValue={p => results[p.id] || '—'}
        />
        <RecapRow
          label="Desempenho"
          participants={participants}
          winnerId={winnerId}
          getValue={p => entries[p.id] ? String(entries[p.id].perf) : '—'}
        />
        {usedIntensity && (
          <RecapRow
            label="Esforço (%FC)"
            participants={participants}
            winnerId={winnerId}
            getValue={p => entries[p.id]?.effort != null ? `${entries[p.id].effort}%` : '—'}
          />
        )}
        <RecapRow
          label="Placar final"
          participants={participants}
          winnerId={winnerId}
          getValue={p => entries[p.id] ? String(entries[p.id].total) : '—'}
          bold
        />
      </div>

      {/* Por que venceu */}
      {edge && (
        <div className="mx-4 mb-4 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5 flex flex-col gap-1">
          <p className="text-[9px] font-black text-primary uppercase tracking-widest">
            A vantagem de {winnerName}: {edge.summary}
          </p>
          <ul className="flex flex-col gap-0.5">
            {edge.insights.map((ins, i) => (
              <li key={i} className="text-[10px] text-on-surface-variant font-medium leading-snug">• {ins.text}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function RecapRow({
  label, participants, winnerId, getValue, bold,
}: {
  label: string;
  participants: RecapParticipant[];
  winnerId: string | null;
  getValue: (p: RecapParticipant) => string;
  bold?: boolean;
}) {
  return (
    <>
      <div className={cn(
        'py-1.5 text-[9px] uppercase tracking-widest whitespace-nowrap pr-2',
        bold ? 'text-on-surface font-black' : 'text-on-surface-variant/70 font-bold'
      )}>
        {label}
      </div>
      {participants.map(p => (
        <div
          key={p.id}
          className={cn(
            'py-1.5 text-center font-bold',
            bold ? 'text-sm' : 'text-xs',
            p.id === winnerId ? 'text-primary' : 'text-on-surface'
          )}
        >
          {getValue(p)}
        </div>
      ))}
    </>
  );
}
