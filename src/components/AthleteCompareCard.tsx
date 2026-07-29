import { CompareRow, summarizeCompare } from '../lib/benchmarkCompare';
import { cn } from '../lib/utils';

interface AthleteCompareCardProps {
  meName: string;
  otherName: string;
  rows: CompareRow[];
}

export default function AthleteCompareCard({ meName, otherName, rows }: AthleteCompareCardProps) {
  const summary = summarizeCompare(rows);
  const meFirst = meName.split(' ')[0];
  const otherFirst = otherName.split(' ')[0];

  return (
    <div className="bg-surface-container-highest/40 rounded-2xl border border-outline-variant/10 overflow-hidden">
      <div className="px-4 pt-4 pb-3 flex flex-col gap-0.5">
        <p className="text-[9px] font-black text-on-surface-variant/60 uppercase tracking-widest">
          {summary.comparable} exercício{summary.comparable !== 1 ? 's' : ''} em comum
        </p>
        <h3 className="font-headline font-black italic text-lg uppercase bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          {meFirst} vs {otherFirst}
        </h3>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 pb-4 text-xs text-on-surface-variant font-bold uppercase tracking-widest italic">
          Nenhum benchmark registrado ainda.
        </p>
      ) : (
        <div className="px-4 pb-3 grid grid-cols-[1fr_auto_auto] gap-y-1 gap-x-3 items-center">
          <div />
          <div className="text-center text-[9px] font-black uppercase tracking-widest text-primary pb-1">Você</div>
          <div className="text-center text-[9px] font-black uppercase tracking-widest text-on-surface-variant pb-1 truncate max-w-[80px]">{otherFirst}</div>

          {rows.map(r => (
            <RowCells key={r.exercise} row={r} />
          ))}
        </div>
      )}

      {summary.comparable > 0 && (
        <div className="mx-4 mb-4 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5 flex flex-col gap-1">
          <p className="text-[9px] font-black text-primary uppercase tracking-widest">
            {summary.meWins > summary.otherWins
              ? `Você está na frente: ${summary.meWins} x ${summary.otherWins}`
              : summary.otherWins > summary.meWins
                ? `${otherFirst} está na frente: ${summary.otherWins} x ${summary.meWins}`
                : `Empate: ${summary.meWins} x ${summary.otherWins}`}
          </p>
          {summary.strengthEdge && (
            <p className="text-[10px] text-on-surface-variant font-medium leading-snug">
              • {summary.strengthEdge === 'me' ? 'Você tem' : `${otherFirst} tem`} maior força relativa (carga ÷ peso corporal) nos exercícios de carga
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function RowCells({ row }: { row: CompareRow }) {
  return (
    <>
      <div className="py-1.5 text-[10px] uppercase tracking-widest text-on-surface-variant/70 font-bold truncate">
        {row.exercise}
      </div>
      <Cell value={row.meValue} ratio={row.meRatio} winner={row.meBetter === true} />
      <Cell value={row.otherValue} ratio={row.otherRatio} winner={row.meBetter === false} />
    </>
  );
}

function Cell({ value, ratio, winner }: { value: string | null; ratio: number | null; winner: boolean }) {
  return (
    <div className="py-1.5 text-center min-w-[64px]">
      <p className={cn('text-xs font-bold', winner ? 'text-primary' : 'text-on-surface', !value && 'text-on-surface-variant/40')}>
        {value || '—'}
      </p>
      {ratio != null && (
        <p className="text-[8px] text-on-surface-variant/60 font-medium">{ratio}x peso</p>
      )}
    </div>
  );
}
