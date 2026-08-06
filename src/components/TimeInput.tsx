import { useState, useRef } from 'react';

/** Campo de tempo mm:ss com dois inputs (minutos/segundos) — sempre monta um
 *  valor válido, então formato inválido deixa de ser um jeito de errar.
 *  Usado no WOD do dia (Wod.tsx) e no resultado de duelo por tempo (Duels.tsx). */
export default function TimeInput({ value, onChange, disabled }: { value: string; onChange: (val: string) => void; disabled?: boolean }) {
  const parts = value.split(':');
  const [minutes, setMinutes] = useState(parts[0] ?? '');
  const [seconds, setSeconds] = useState(parts[1] ?? '');
  const secRef = useRef<HTMLInputElement>(null);
  const commit = (m: string, s: string) => onChange(`${m.padStart(2, '0')}:${s.padStart(2, '0')}`);
  const handleMinutes = (raw: string) => {
    const clean = raw.replace(/\D/g, '').slice(0, 2);
    setMinutes(clean); commit(clean, seconds);
    if (clean.length === 2) secRef.current?.focus();
  };
  const handleSeconds = (raw: string) => {
    const clean = raw.replace(/\D/g, '').slice(0, 2);
    const num = parseInt(clean, 10);
    const clamped = isNaN(num) ? clean : String(Math.min(num, 59));
    setSeconds(clamped); commit(minutes, clamped);
  };
  return (
    <div className="flex items-center gap-3 bg-surface-container-highest rounded-2xl p-4">
      <div className="flex-1 flex flex-col items-center gap-1">
        <label className="text-[8px] text-on-surface-variant font-black uppercase tracking-widest">MIN</label>
        <input type="number" inputMode="numeric" min={0} max={99} value={minutes} onChange={(e) => handleMinutes(e.target.value)} placeholder="00" disabled={disabled}
          className="w-full bg-transparent text-center font-headline font-black text-4xl text-on-surface outline-none appearance-none" />
      </div>
      <span className="text-3xl font-black text-on-surface-variant">:</span>
      <div className="flex-1 flex flex-col items-center gap-1">
        <label className="text-[8px] text-on-surface-variant font-black uppercase tracking-widest">SEC</label>
        <input ref={secRef} type="number" inputMode="numeric" min={0} max={59} value={seconds} onChange={(e) => handleSeconds(e.target.value)} placeholder="00" disabled={disabled}
          className="w-full bg-transparent text-center font-headline font-black text-4xl text-on-surface outline-none appearance-none" />
      </div>
    </div>
  );
}
