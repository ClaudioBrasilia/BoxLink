import { useState, useRef } from 'react';
import { cn } from '../lib/utils';

/** Resultado de AMRAP em ROUNDS + REPS, com dois campos numéricos — o jeito que
 *  o atleta lê o próprio resultado no whiteboard ("5 rounds e 12 reps"), e não
 *  um total de reps que ele teria que calcular de cabeça.
 *  Usado no WOD do dia (Wod.tsx) e no resultado de duelo AMRAP (Duels.tsx).
 *
 *  O valor sai sempre no formato "rounds+reps" (ex: "5+12") — mesmo formato do
 *  placar/ranking, então o resultado do duelo entra no diário e no Rank WOD
 *  sem conversão. */
export default function AmrapInput({ value, onChange, disabled, repsPerRound, compact }: {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
  /** Reps de um round completo: limita as reps extras e mostra a dica. */
  repsPerRound?: number | null;
  /** Versão baixa, para caber ao lado do botão de enviar (duelo). */
  compact?: boolean;
}) {
  const match = value.match(/^(\d+)\+(\d+)$/);
  const [rounds, setRounds] = useState(match?.[1] ?? '');
  const [reps, setReps] = useState(match?.[2] ?? '');
  const repsRef = useRef<HTMLInputElement>(null);

  const commit = (r: string, p: string) => {
    if (r || p) onChange(`${r || '0'}+${p || '0'}`);
  };
  const handleRounds = (raw: string) => {
    const clean = raw.replace(/\D/g, '').slice(0, 3);
    setRounds(clean); commit(clean, reps);
    if (clean.length >= 2) repsRef.current?.focus();
  };
  const handleReps = (raw: string) => {
    const clean = raw.replace(/\D/g, '').slice(0, 3);
    // Reps extras são de um round INCOMPLETO — completar o round vira +1 round.
    const maxReps = repsPerRound ? repsPerRound - 1 : 999;
    const num = parseInt(clean, 10);
    const clamped = isNaN(num) ? clean : String(Math.min(num, maxReps));
    setReps(clamped); commit(rounds, clamped);
  };

  const numberClass = cn(
    'w-full bg-transparent text-center font-headline font-black text-on-surface outline-none appearance-none',
    compact ? 'text-2xl' : 'text-4xl',
  );

  return (
    <div className="flex flex-col gap-2">
      <div className={cn('flex items-center gap-3 bg-surface-container-highest rounded-2xl', compact ? 'px-4 py-2' : 'p-4')}>
        <div className="flex-1 flex flex-col items-center gap-1">
          <label className="text-[8px] text-on-surface-variant font-black uppercase tracking-widest">ROUNDS</label>
          <input type="number" inputMode="numeric" min={0} value={rounds}
            onChange={(e) => handleRounds(e.target.value)} placeholder="0" disabled={disabled}
            className={numberClass} />
        </div>
        <span className={cn('font-black text-primary', compact ? 'text-xl' : 'text-3xl')}>+</span>
        <div className="flex-1 flex flex-col items-center gap-1">
          <label className="text-[8px] text-on-surface-variant font-black uppercase tracking-widest">REPS</label>
          <input ref={repsRef} type="number" inputMode="numeric" min={0} value={reps}
            onChange={(e) => handleReps(e.target.value)} placeholder="0" disabled={disabled}
            className={numberClass} />
        </div>
      </div>
      {repsPerRound ? (
        <p className="text-center text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">
          {repsPerRound} reps por round completo
        </p>
      ) : null}
    </div>
  );
}
