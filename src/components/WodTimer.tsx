import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Play, Pause, RotateCcw, Flag, Timer as TimerIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { useKeepScreenAwake } from '../hooks/useKeepScreenAwake';

// ─── Tipos ──────────────────────────────────────────────────────────────────
export type WodTimerType = 'FOR TIME' | 'AMRAP' | 'EMOM' | 'TABATA';

export interface WodTimerResult {
  wodType: WodTimerType;
  title: string;
  description: string;
  result: string;   // "12:45", "5+12", "Completo (CAP)"...
}

interface Props {
  onClose: () => void;
  onFinish: (data: WodTimerResult) => void;
}

const fmt = (totalSec: number) => {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
};

const TABATA_WORK = 20;
const TABATA_REST = 10;

export default function WodTimer({ onClose, onFinish }: Props) {
  // Setup
  const [phase, setPhase] = useState<'setup' | 'run' | 'amrapScore'>('setup');
  const [type, setType] = useState<WodTimerType>('FOR TIME');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [minutes, setMinutes] = useState(12);   // AMRAP duração / EMOM total / FOR TIME cap
  const [capEnabled, setCapEnabled] = useState(false);
  const [tabataRounds, setTabataRounds] = useState(8);

  // Run
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);     // segundos decorridos
  const [finished, setFinished] = useState(false);
  const baseRef = useRef(0);
  const startedRef = useRef(0);
  const lastWholeRef = useRef(-1);

  // AMRAP score
  const [rounds, setRounds] = useState('');
  const [reps, setReps] = useState('');

  useKeepScreenAwake(phase === 'run');

  // ── Áudio ──
  const audioRef = useRef<AudioContext | null>(null);
  const beep = useCallback((freq = 880, dur = 160) => {
    try {
      if (!audioRef.current) {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        audioRef.current = new Ctx();
      }
      const ctx = audioRef.current!;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = freq;
      o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.25, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur / 1000);
      o.start();
      o.stop(ctx.currentTime + dur / 1000);
    } catch { /* silencioso */ }
    try { navigator.vibrate?.(70); } catch { /* noop */ }
  }, []);

  const totalSec = minutes * 60;

  // ── Estado derivado por tipo ──
  const isCountdown = type === 'AMRAP';
  const remaining = Math.max(0, totalSec - elapsed);

  // Tabata: fase atual
  const tabataCycle = TABATA_WORK + TABATA_REST;
  const tabataTotal = tabataRounds * tabataCycle;
  const inCycle = elapsed % tabataCycle;
  const tabataWork = inCycle < TABATA_WORK;
  const tabataRound = Math.min(tabataRounds, Math.floor(elapsed / tabataCycle) + 1);
  const tabataPhaseRemaining = tabataWork ? TABATA_WORK - inCycle : tabataCycle - inCycle;

  // EMOM
  const emomRound = Math.min(minutes, Math.floor(elapsed / 60) + 1);
  const emomSecInMin = 60 - (elapsed % 60);

  const finishNow = useCallback((auto = false) => {
    setRunning(false);
    setFinished(true);
    beep(auto ? 660 : 990, 400);
    if (type === 'AMRAP') setPhase('amrapScore');
  }, [type, beep]);

  // ── Loop ──
  useEffect(() => {
    if (!running) return;
    startedRef.current = Date.now();
    const id = setInterval(() => {
      const el = baseRef.current + (Date.now() - startedRef.current) / 1000;
      setElapsed(el);

      const whole = Math.floor(el);
      if (whole !== lastWholeRef.current) {
        lastWholeRef.current = whole;
        // Beeps por tipo
        if (type === 'EMOM' && whole > 0 && whole % 60 === 0) beep(880, 180);
        if (type === 'TABATA') {
          const c = whole % tabataCycle;
          if (whole > 0 && (c === 0 || c === TABATA_WORK)) beep(c === 0 ? 990 : 520, 180);
        }
        if (isCountdown) {
          const rem = totalSec - whole;
          if (rem === 3 || rem === 2 || rem === 1) beep(700, 120);
        }
        if ((type === 'FOR TIME' && capEnabled) ) {
          const rem = totalSec - whole;
          if (rem === 3 || rem === 2 || rem === 1) beep(700, 120);
        }
      }

      // Auto-finish
      if (type === 'AMRAP' && el >= totalSec) { setElapsed(totalSec); finishNow(true); }
      if (type === 'FOR TIME' && capEnabled && el >= totalSec) { setElapsed(totalSec); finishNow(true); }
      if (type === 'EMOM' && el >= totalSec) { setElapsed(totalSec); finishNow(true); }
      if (type === 'TABATA' && el >= tabataTotal) { setElapsed(tabataTotal); finishNow(true); }
    }, 100);
    return () => {
      // acumula o tempo do segmento ao pausar/desmontar
      baseRef.current = baseRef.current + (Date.now() - startedRef.current) / 1000;
      clearInterval(id);
    };
  }, [running, type, capEnabled, totalSec, tabataTotal, tabataCycle, isCountdown, finishNow, beep]);

  const start = () => {
    // desbloqueia áudio no gesto
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioRef.current) audioRef.current = new Ctx();
      audioRef.current!.resume?.();
    } catch { /* noop */ }
    lastWholeRef.current = Math.floor(elapsed);
    setRunning(true);
  };
  const pause = () => setRunning(false);
  const reset = () => { setRunning(false); setFinished(false); baseRef.current = 0; lastWholeRef.current = -1; setElapsed(0); };

  const buildResult = (): string => {
    if (type === 'AMRAP') {
      const r = rounds.trim() || '0';
      const rp = reps.trim() || '0';
      return `${r}+${rp}`;
    }
    if (type === 'FOR TIME') {
      const capped = capEnabled && elapsed >= totalSec;
      return capped ? `${fmt(totalSec)} (CAP)` : fmt(elapsed);
    }
    if (type === 'EMOM') return `${minutes} min completos`;
    return `${tabataRounds} rounds`; // TABATA
  };

  const confirm = () => {
    onFinish({
      wodType: type,
      title: title.trim() || type,
      description: description.trim(),
      result: buildResult(),
    });
  };

  // ── Display principal ──
  const bigTime = (() => {
    if (type === 'AMRAP') return fmt(remaining);
    if (type === 'EMOM') return `0:${String(emomSecInMin).padStart(2, '0')}`;
    if (type === 'TABATA') return `0:${String(Math.ceil(tabataPhaseRemaining)).padStart(2, '0')}`;
    return fmt(elapsed); // FOR TIME
  })();

  const subLabel = (() => {
    if (type === 'AMRAP') return running || finished ? 'Tempo restante' : `AMRAP ${minutes} min`;
    if (type === 'EMOM') return `Minuto ${emomRound}/${minutes}`;
    if (type === 'TABATA') return `${tabataWork ? 'WORK' : 'REST'} • Round ${tabataRound}/${tabataRounds}`;
    return capEnabled ? `For Time • cap ${minutes} min` : 'For Time';
  })();

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[60] bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-6 pt-12">
        <div className="flex items-center gap-2">
          <TimerIcon className="w-5 h-5 text-primary" />
          <h2 className="font-headline font-black text-lg text-on-surface uppercase italic">Meu WOD</h2>
        </div>
        <button onClick={onClose} className="w-9 h-9 rounded-full bg-surface-container-highest flex items-center justify-center">
          <X className="w-5 h-5 text-on-surface-variant" />
        </button>
      </div>

      {/* SETUP */}
      {phase === 'setup' && (
        <div className="flex-1 overflow-y-auto px-6 pb-8 flex flex-col gap-5">
          <div className="grid grid-cols-4 gap-2">
            {(['FOR TIME', 'AMRAP', 'EMOM', 'TABATA'] as WodTimerType[]).map(t => (
              <button key={t} onClick={() => setType(t)}
                className={cn('py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all',
                  type === t ? 'bg-primary/10 border-primary/40 text-primary' : 'bg-surface-container-highest border-transparent text-on-surface-variant')}>
                {t === 'FOR TIME' ? 'For Time' : t}
              </button>
            ))}
          </div>

          <input type="text" placeholder="Nome do WOD (ex: Fran, meu AMRAP)" value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full bg-surface-container-highest rounded-2xl px-4 py-3 text-sm font-medium text-on-surface outline-none" />

          <textarea placeholder="Movimentos (ex: 21-15-9 Thruster + Pull-up)" value={description}
            onChange={e => setDescription(e.target.value)} rows={3}
            className="w-full bg-surface-container-highest rounded-2xl px-4 py-3 text-sm font-medium text-on-surface outline-none resize-none" />

          {/* Parâmetros por tipo */}
          {type === 'FOR TIME' && (
            <div className="flex items-center justify-between bg-surface-container-highest/50 rounded-2xl p-4 border border-outline-variant/10">
              <div>
                <p className="text-[11px] font-black text-on-surface uppercase tracking-widest">Time cap</p>
                <p className="text-[9px] text-on-surface-variant font-bold uppercase">Para o cronômetro no limite</p>
              </div>
              <div className="flex items-center gap-3">
                {capEnabled && (
                  <input type="number" min={1} max={90} value={minutes} onChange={e => setMinutes(Math.max(1, +e.target.value))}
                    className="w-16 bg-surface-container rounded-xl px-3 py-2 text-sm font-bold text-on-surface outline-none text-center" />
                )}
                <button onClick={() => setCapEnabled(v => !v)}
                  className={cn('w-12 h-6 rounded-full relative transition-all', capEnabled ? 'bg-primary' : 'bg-outline-variant/30')}>
                  <div className={cn('w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all', capEnabled ? 'left-6' : 'left-0.5')} />
                </button>
              </div>
            </div>
          )}
          {(type === 'AMRAP' || type === 'EMOM') && (
            <div className="flex items-center justify-between bg-surface-container-highest/50 rounded-2xl p-4 border border-outline-variant/10">
              <p className="text-[11px] font-black text-on-surface uppercase tracking-widest">
                {type === 'AMRAP' ? 'Duração (min)' : 'Total de minutos'}
              </p>
              <input type="number" min={1} max={90} value={minutes} onChange={e => setMinutes(Math.max(1, +e.target.value))}
                className="w-20 bg-surface-container rounded-xl px-3 py-2 text-lg font-black text-primary outline-none text-center" />
            </div>
          )}
          {type === 'TABATA' && (
            <div className="flex items-center justify-between bg-surface-container-highest/50 rounded-2xl p-4 border border-outline-variant/10">
              <div>
                <p className="text-[11px] font-black text-on-surface uppercase tracking-widest">Rounds</p>
                <p className="text-[9px] text-on-surface-variant font-bold uppercase">20s work / 10s rest</p>
              </div>
              <input type="number" min={1} max={30} value={tabataRounds} onChange={e => setTabataRounds(Math.max(1, +e.target.value))}
                className="w-20 bg-surface-container rounded-xl px-3 py-2 text-lg font-black text-primary outline-none text-center" />
            </div>
          )}

          <button onClick={() => { reset(); setPhase('run'); }}
            className="mt-auto w-full bg-primary text-background py-4 rounded-2xl font-headline font-black text-sm uppercase italic flex items-center justify-center gap-2 hover:opacity-90 transition-all">
            <Play className="w-5 h-5" /> Ir para o cronômetro
          </button>
        </div>
      )}

      {/* RUN */}
      {phase === 'run' && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-8">
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-on-surface-variant">{subLabel}</p>
          <div className={cn('font-headline font-black italic tabular-nums leading-none text-center transition-colors',
            type === 'TABATA' ? (tabataWork ? 'text-primary' : 'text-secondary') : 'text-primary',
            'text-[26vw]')}>
            {bigTime}
          </div>
          {title && <p className="text-sm font-headline font-black text-on-surface-variant uppercase italic -mt-4">{title}</p>}
          {finished && <p className="text-secondary font-black uppercase tracking-widest text-sm animate-pulse">Tempo!</p>}

          {/* Controles */}
          {!finished ? (
            <div className="flex items-center gap-4">
              <button onClick={reset} className="w-14 h-14 rounded-2xl bg-surface-container-highest flex items-center justify-center text-on-surface-variant">
                <RotateCcw className="w-6 h-6" />
              </button>
              {running ? (
                <button onClick={pause} className="w-20 h-20 rounded-3xl bg-secondary text-background flex items-center justify-center">
                  <Pause className="w-9 h-9" strokeWidth={2.5} />
                </button>
              ) : (
                <button onClick={start} className="w-20 h-20 rounded-3xl bg-primary text-background flex items-center justify-center shadow-[0_0_40px_rgba(202,253,0,0.3)]">
                  <Play className="w-9 h-9" strokeWidth={2.5} />
                </button>
              )}
              <button onClick={() => finishNow(false)} className="w-14 h-14 rounded-2xl bg-surface-container-highest flex items-center justify-center text-primary">
                <Flag className="w-6 h-6" />
              </button>
            </div>
          ) : (
            type !== 'AMRAP' && (
              <div className="w-full flex flex-col gap-3">
                <div className="bg-surface-container rounded-2xl px-5 py-4 flex justify-between items-center border border-primary/20">
                  <span className="text-[11px] font-black text-on-surface-variant uppercase tracking-widest">Resultado</span>
                  <span className="text-xl font-headline font-black text-primary italic">{buildResult()}</span>
                </div>
                <button onClick={confirm}
                  className="w-full bg-primary text-background py-4 rounded-2xl font-headline font-black text-sm uppercase italic hover:opacity-90 transition-all">
                  Salvar no Diário
                </button>
                <button onClick={reset} className="w-full text-on-surface-variant font-headline font-black text-xs uppercase italic py-2">
                  Refazer
                </button>
              </div>
            )
          )}
        </div>
      )}

      {/* AMRAP score */}
      {phase === 'amrapScore' && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
          <p className="text-secondary font-black uppercase tracking-widest text-sm">Tempo! Quanto você fez?</p>
          <div className="flex items-end gap-3">
            <div className="flex flex-col items-center gap-1">
              <input type="number" min={0} value={rounds} onChange={e => setRounds(e.target.value)} placeholder="0"
                className="w-24 bg-surface-container-highest rounded-2xl px-3 py-4 text-3xl font-black text-primary outline-none text-center" />
              <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Rounds</span>
            </div>
            <span className="text-3xl font-black text-on-surface-variant pb-6">+</span>
            <div className="flex flex-col items-center gap-1">
              <input type="number" min={0} value={reps} onChange={e => setReps(e.target.value)} placeholder="0"
                className="w-24 bg-surface-container-highest rounded-2xl px-3 py-4 text-3xl font-black text-primary outline-none text-center" />
              <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Reps</span>
            </div>
          </div>
          <button onClick={confirm}
            className="w-full bg-primary text-background py-4 rounded-2xl font-headline font-black text-sm uppercase italic hover:opacity-90 transition-all">
            Salvar no Diário
          </button>
        </div>
      )}
    </div>
  );
}
