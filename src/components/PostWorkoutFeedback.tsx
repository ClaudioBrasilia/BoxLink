import { cn } from '../lib/utils';
import { TrainingFeeling } from '../types';

const FEELINGS: { value: TrainingFeeling; label: string; emoji: string }[] = [
  { value: 'otimo',   label: 'Ótimo',   emoji: '🔥' },
  { value: 'bem',     label: 'Bem',     emoji: '🙂' },
  { value: 'normal',  label: 'Normal',  emoji: '😐' },
  { value: 'cansado', label: 'Cansado', emoji: '🥱' },
  { value: 'dor',     label: 'Dor',     emoji: '🤕' },
];

interface Props {
  rpe: number;
  onRpeChange: (n: number) => void;
  feeling: TrainingFeeling | null;
  onFeelingChange: (f: TrainingFeeling | null) => void;
  sleepHours: string;
  onSleepHoursChange: (v: string) => void;
  notes: string;
  onNotesChange: (v: string) => void;
  notesPlaceholder?: string;
  /** Esconde o RPE quando não faz sentido (ex: uma nota sem treino). Padrão: true. */
  showRpe?: boolean;
}

/** Bloco de percepção de esforço pós-treino (RPE, sensação, sono, notas) —
 * reutilizado no Diário (Individual) e no registro de WOD (Box). */
export default function PostWorkoutFeedback({
  rpe, onRpeChange, feeling, onFeelingChange, sleepHours, onSleepHoursChange, notes, onNotesChange, notesPlaceholder, showRpe = true,
}: Props) {
  return (
    <>
      {showRpe && (
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">
            Esforço percebido (RPE) {rpe > 0 ? `— ${rpe}/10` : ''}
          </label>
          <div className="flex gap-1">
            {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
              <button
                key={n}
                onClick={() => onRpeChange(n === rpe ? 0 : n)}
                className={cn(
                  'flex-1 py-2 rounded-lg text-[10px] font-black transition-all',
                  n <= rpe ? 'bg-primary text-background' : 'bg-surface-container-highest text-on-surface-variant'
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Como você está?</label>
        <div className="flex gap-2">
          {FEELINGS.map(f => (
            <button
              key={f.value}
              onClick={() => onFeelingChange(feeling === f.value ? null : f.value)}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border transition-all',
                feeling === f.value
                  ? 'bg-primary/10 border-primary/40'
                  : 'bg-surface-container-highest border-transparent'
              )}
            >
              <span className="text-base leading-none">{f.emoji}</span>
              <span className={cn(
                'text-[8px] font-black uppercase tracking-wider',
                feeling === f.value ? 'text-primary' : 'text-on-surface-variant'
              )}>
                {f.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">
          Horas de sono (noite anterior)
        </label>
        <input
          type="text"
          inputMode="decimal"
          placeholder="Ex: 7.5"
          value={sleepHours}
          onChange={e => onSleepHoursChange(e.target.value)}
          className="w-full bg-surface-container-highest rounded-2xl px-4 py-3 text-sm font-medium text-on-surface outline-none"
        />
      </div>

      <textarea
        placeholder={notesPlaceholder ?? 'Anotações (sono, dieta, dores, observações...)'}
        value={notes}
        onChange={e => onNotesChange(e.target.value)}
        rows={2}
        className="w-full bg-surface-container-highest rounded-2xl px-4 py-3 text-sm font-medium text-on-surface outline-none resize-none"
      />
    </>
  );
}
