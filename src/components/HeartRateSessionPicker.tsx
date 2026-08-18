import { Activity, CheckCircle2, Clock3, Heart, X } from 'lucide-react';
import type { StoredHrSession } from '../lib/heartRateSessions';

interface Props {
  sessions: StoredHrSession[];
  selectedId?: string | null;
  onSelect: (session: StoredHrSession) => void;
  onSkip: () => void;
}

function sessionDate(session: StoredHrSession): string {
  const raw = session.ended_at || session.started_at;
  if (!raw) return 'Horário não informado';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return 'Horário não informado';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(date);
}

function sessionDuration(seconds: number): string {
  const mins = Math.floor(Math.max(0, seconds || 0) / 60);
  return `${mins} min`;
}

export default function HeartRateSessionPicker({ sessions, selectedId, onSelect, onSkip }: Props) {
  return (
    <div className="fixed inset-0 z-[70] bg-background/95 backdrop-blur-sm flex flex-col">
      <div className="flex items-center justify-between p-6 pt-12">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-secondary">Vínculo seguro</p>
          <h2 className="font-headline font-black text-lg text-on-surface uppercase italic">Qual medição foi deste WOD?</h2>
        </div>
        <button onClick={onSkip} aria-label="Fechar seleção" className="w-9 h-9 rounded-full bg-surface-container-highest flex items-center justify-center">
          <X className="w-5 h-5 text-on-surface-variant" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-8 flex flex-col gap-4">
        <div className="bg-secondary/10 border border-secondary/20 rounded-2xl px-4 py-3 flex items-start gap-2">
          <Heart className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
          <p className="text-[11px] text-on-surface-variant font-bold leading-snug">
            Encontramos mais de uma medição válida nas últimas horas. Escolha uma para incluir o esforço na comparação; se preferir, continue sem vincular.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {sessions.map((session) => {
            const selected = selectedId === session.id;
            return (
              <button
                key={session.id}
                type="button"
                onClick={() => onSelect(session)}
                className={`text-left rounded-2xl border-2 p-4 transition-all ${selected
                  ? 'border-primary bg-primary/10'
                  : 'border-outline-variant/20 bg-surface-container-highest hover:border-secondary/50'}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Activity className={`w-4 h-4 ${selected ? 'text-primary' : 'text-secondary'}`} />
                    <span className="text-xs font-black text-on-surface uppercase tracking-widest">
                      {session.device_name || 'Sessão de FC'}
                    </span>
                  </div>
                  {selected && <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />}
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3 text-[10px] font-black uppercase tracking-widest">
                  <div className="flex items-center gap-1 text-on-surface-variant"><Clock3 className="w-3.5 h-3.5" />{sessionDate(session)}</div>
                  <span className="text-on-surface-variant">{sessionDuration(session.duration_sec)}</span>
                  <span className="text-on-surface text-right">{session.avg_bpm} bpm méd.</span>
                </div>
                <p className="text-[10px] font-bold text-on-surface-variant/70 mt-2 uppercase tracking-widest">
                  Pico {session.max_bpm} bpm · Esforço {session.effort}
                </p>
              </button>
            );
          })}
        </div>

        <button type="button" onClick={onSkip} className="w-full py-4 rounded-2xl bg-surface-container-highest text-on-surface-variant font-headline font-black text-sm uppercase italic">
          Continuar sem vincular
        </button>
      </div>
    </div>
  );
}
