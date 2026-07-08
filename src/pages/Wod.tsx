import { useState, useEffect, useRef } from 'react';
import { Calendar, Timer, Activity, Trophy, ChevronLeft, ChevronRight, Flame, Star, Edit2, CheckCircle2, X, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { Wod as WodType } from '../types';
import { format, addDays, subDays, eachDayOfInterval, isSameDay } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { supabase } from '../lib/supabase';
import { addReward, getRewardSettings } from '../utils/rewards';
import { calcInactivity, InactivitySettings, InactivityState } from '../utils/inactivity';
import HeartRateDisplay from '../components/HeartRateDisplay';

const TIMEZONE = 'America/Sao_Paulo';

type ToastType = 'success' | 'info' | 'warning' | 'error';
interface Toast { id: number; message: string; type: ToastType; }

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-[90vw] max-w-sm pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div key={t.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className={cn(
              'pointer-events-auto flex items-start gap-3 p-4 rounded-2xl shadow-xl border text-sm font-bold',
              t.type === 'success' && 'bg-primary text-background border-primary/50',
              t.type === 'info' && 'bg-surface-container-low text-on-surface border-outline-variant/20',
              t.type === 'warning' && 'bg-secondary/20 text-secondary border-secondary/30',
              t.type === 'error' && 'bg-red-500/10 text-red-400 border-red-500/30',
            )}
          >
            <span className="flex-1 leading-snug">{t.message}</span>
            <button onClick={() => onRemove(t.id)} className="opacity-60 hover:opacity-100 transition-opacity mt-0.5 shrink-0">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function TimeInput({ value, onChange, disabled }: { value: string; onChange: (val: string) => void; disabled?: boolean }) {
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

// Input especial para AMRAP: rounds + reps
function AmrapInput({ value, onChange, disabled, repsPerRound }: {
  value: string; onChange: (val: string) => void; disabled?: boolean; repsPerRound?: number;
}) {
  const parseAmrap = (v: string) => {
    const match = v.match(/^(\d+)\+(\d+)$/);
    return { rounds: match?.[1] ?? '', reps: match?.[2] ?? '' };
  };
  const parsed = parseAmrap(value);
  const [rounds, setRounds] = useState(parsed.rounds);
  const [reps, setReps] = useState(parsed.reps);
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
    const maxReps = repsPerRound ? repsPerRound - 1 : 999;
    const num = parseInt(clean, 10);
    const clamped = isNaN(num) ? clean : String(Math.min(num, maxReps));
    setReps(clamped); commit(rounds, clamped);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3 bg-surface-container-highest rounded-2xl p-4">
        <div className="flex-1 flex flex-col items-center gap-1">
          <label className="text-[8px] text-on-surface-variant font-black uppercase tracking-widest">ROUNDS</label>
          <input type="number" inputMode="numeric" min={0} value={rounds}
            onChange={(e) => handleRounds(e.target.value)} placeholder="0" disabled={disabled}
            className="w-full bg-transparent text-center font-headline font-black text-4xl text-on-surface outline-none appearance-none" />
        </div>
        <span className="text-3xl font-black text-primary">+</span>
        <div className="flex-1 flex flex-col items-center gap-1">
          <label className="text-[8px] text-on-surface-variant font-black uppercase tracking-widest">REPS</label>
          <input ref={repsRef} type="number" inputMode="numeric" min={0} value={reps}
            onChange={(e) => handleReps(e.target.value)} placeholder="0" disabled={disabled}
            className="w-full bg-transparent text-center font-headline font-black text-4xl text-on-surface outline-none appearance-none" />
        </div>
      </div>
      {repsPerRound && (
        <p className="text-center text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">
          {repsPerRound} reps por round completo
        </p>
      )}
    </div>
  );
}

function parseLines(text: string): string[] {
  return text.split('\n').map((l) => l.trim()).filter(Boolean);
}

function MovementRow({ line }: { line: string }) {
  const match = line.match(/^(\d+[\w\/]*(?:\s*[xX×]\s*\d+)?(?:\s*(?:m|kg|lb|cal|min|sec|s))?)\s+(.+)$/);
  if (match) {
    return (
      <div className="flex items-baseline gap-3 py-1.5 border-b border-outline-variant/10 last:border-0">
        <span className="text-2xl font-black text-on-surface min-w-[2.5rem] leading-none">{match[1]}</span>
        <span className="text-sm text-on-surface-variant leading-snug flex-1">{match[2]}</span>
      </div>
    );
  }
  return (
    <div className="py-1.5 border-b border-outline-variant/10 last:border-0">
      <span className="text-sm font-bold text-primary">{line}</span>
    </div>
  );
}

function WodSection({ icon, label, labelColor, text }: {
  icon: React.ReactNode; label: string; labelColor?: string; text: string;
}) {
  const lines = parseLines(text);
  if (!lines.length) return null;
  return (
    <div className="bg-surface-container-low rounded-2xl p-4 flex flex-col gap-1">
      <div className={cn('flex items-center gap-1.5 mb-2', labelColor ?? 'text-on-surface-variant')}>
        {icon}
        <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
      </div>
      {lines.map((line, i) => <MovementRow key={i} line={line} />)}
    </div>
  );
}

const CATEGORY_OPTIONS = [
  { value: 'RX',     label: 'RX',     color: 'bg-primary text-background',           border: 'border-primary' },
  { value: 'Scaled', label: 'SCALED', color: 'bg-secondary text-background',         border: 'border-secondary' },
];

export default function Wod() {
  const { user } = useAuth();
  const [wod, setWod] = useState<WodType | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [result, setResult] = useState('');
  const [category, setCategory] = useState<'RX' | 'Scaled'>('RX');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [existingResultId, setExistingResultId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [editing, setEditing] = useState(false);
  const [weekDays, setWeekDays] = useState<Date[]>([]);
  const [inactivity, setInactivity] = useState<InactivityState | null>(null);
  const [inactivityLoading, setInactivityLoading] = useState(true);

  const addToast = (message: string, type: ToastType = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  };

  useEffect(() => {
    const today = new Date();
    setWeekDays(eachDayOfInterval({ start: subDays(today, 3), end: addDays(today, 3) }));
  }, []);

  useEffect(() => { fetchWod(); }, [selectedDate, user]);

  // Bloqueio do WOD por inatividade: só vale pra quem é 'athlete' (admin/coach nunca são bloqueados)
  useEffect(() => {
    if (!user) return;
    if (user.role !== 'athlete') { setInactivityLoading(false); return; }

    setInactivityLoading(true);
    supabase.from('box_settings').select('inactivity').maybeSingle().then(({ data }) => {
      const settings: InactivitySettings = data?.inactivity || { enabled: false, minWorkoutsPerWeek: 3, excludeSunday: true };
      setInactivity(calcInactivity(user.checkins || [], settings));
      setInactivityLoading(false);
    });
  }, [user]);

  // Se o aluno já fez check-in hoje, o WOD nunca fica bloqueado — senão ele
  // nunca conseguiria ver/registrar o treino do dia em que está voltando a treinar.
  const todayStrSP = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const checkedInToday = (user?.checkins || []).some((c) => c.date === todayStrSP);

  const wodBlocked = !inactivityLoading && user?.role === 'athlete' && !!inactivity
    && inactivity.missingWorkouts > 0 && !checkedInToday;

  const fetchWod = async () => {
    if (!user) return;
    setLoading(true); setSubmitted(false); setExistingResultId(null); setResult('');
    const dateStr = formatInTimeZone(selectedDate, TIMEZONE, 'yyyy-MM-dd');
    let { data: wodData } = await supabase.from('wods').select('*').eq('date', dateStr).maybeSingle();
    if (!wodData && isSameDay(selectedDate, new Date())) {
      const { data: latestWod } = await supabase.from('wods').select('*').order('date', { ascending: false }).limit(1).maybeSingle();
      wodData = latestWod;
    }
    setWod(wodData ?? null);
    if (wodData) {
      const { data: resultData } = await supabase.from('wod_results').select('*')
        .eq('wod_id', wodData.id).eq('user_id', user.id).maybeSingle();
      if (resultData) {
        setSubmitted(true);
        setExistingResultId(resultData.id);
        setResult(resultData.result ?? '');
        setCategory((resultData.type as 'RX' | 'Scaled') || 'RX');
      }
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!user || !wod || !result.trim()) return;
    setSubmitting(true);
    try {
      if (existingResultId) {
        await supabase.from('wod_results').update({ result, type: category }).eq('id', existingResultId);
        addToast('Resultado atualizado!', 'success');
      } else {
        const { data } = await supabase.from('wod_results')
          .insert({ wod_id: wod.id, user_id: user.id, result, type: category }).select().single();
        setExistingResultId(data?.id ?? null);

        const rewards = await getRewardSettings();
        const wodXp    = rewards.wod_xp    ?? 10;
        const wodCoins = rewards.wod_coins  ?? 5;

        const rewardResult = await addReward(user.id, 'wod_complete', wodXp, wodCoins, 'WOD concluído', wod.id);
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });

        let msg = `WOD concluído! +${wodXp} XP e +${wodCoins} BrazaCoins 🎉`;
        if (rewardResult?.levelUp) {
          msg += ` ⬆️ LEVEL UP! Nível ${rewardResult.newLevel}!`;
          setTimeout(() => confetti({ particleCount: 200, spread: 100, origin: { y: 0.5 }, colors: ['#CAFD00', '#FFFFFF'] }), 400);
        }
        addToast(msg, 'success');
      }
      setSubmitted(true); setEditing(false);
    } catch {
      addToast('Erro ao salvar resultado.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const isToday = isSameDay(selectedDate, new Date());
  const wodType = (wod?.type ?? '').toUpperCase();
  const isTimeBased = wodType === 'FOR TIME' || wodType === 'TIME' || wodType === 'FORTIME';
  const isAmrap = wodType === 'AMRAP';
  const repsPerRound = (wod as any)?.reps_per_round as number | undefined;

  if (inactivityLoading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (wodBlocked && inactivity) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-surface-container-highest flex items-center justify-center">
          <Lock className="w-7 h-7 text-on-surface-variant" />
        </div>
        <h1 className="text-lg font-black text-on-surface uppercase">Treino bloqueado</h1>
        <p className="text-sm text-on-surface-variant leading-relaxed max-w-xs">
          Você precisa de pelo menos {inactivity.requiredWorkouts} check-ins nos últimos 7 dias para ver o treino.
          Você tem {inactivity.checkinsInWindow} de {inactivity.requiredWorkouts}.
        </p>
        <p className="text-xs text-on-surface-variant/70 max-w-xs">
          Faça o check-in na academia para desbloquear o treino do dia.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-24">
      <ToastContainer toasts={toasts} onRemove={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />

      <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none">
        <button onClick={() => setSelectedDate((d) => subDays(d, 7))} className="shrink-0 p-1 text-on-surface-variant">
          <ChevronLeft className="w-5 h-5" />
        </button>
        {weekDays.map((day) => {
          const active = isSameDay(day, selectedDate);
          const todayDay = isSameDay(day, new Date());
          return (
            <button key={day.toISOString()} onClick={() => setSelectedDate(day)}
              className={cn(
                'shrink-0 flex flex-col items-center justify-center w-12 h-14 rounded-2xl text-xs font-bold transition-all',
                active ? 'bg-primary text-background'
                  : todayDay ? 'bg-surface-container-highest text-primary'
                  : 'bg-surface-container text-on-surface-variant',
              )}
            >
              <span className="text-[10px] uppercase">{format(day, 'EEE')}</span>
              <span className="text-lg">{format(day, 'd')}</span>
            </button>
          );
        })}
        <button onClick={() => setSelectedDate((d) => addDays(d, 7))} className="shrink-0 p-1 text-on-surface-variant">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <Calendar className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-black text-on-surface">
          {isToday ? 'WOD de Hoje' : format(selectedDate, "dd 'de' MMMM")}
        </h1>
        {wod && (
          <span className="ml-auto text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-primary/10 text-primary">
            {wod.type?.toUpperCase()}
          </span>
        )}
      </div>

      {isToday && (
        <>
        </>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !wod ? (
        <div className="flex flex-col items-center gap-3 py-16 text-on-surface-variant">
          <Activity className="w-10 h-10 opacity-30" />
          <p className="text-sm font-medium">Nenhum WOD para este dia.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {(wod.warmup || wod.skill) && (
            <div className={cn('grid gap-3', wod.warmup && wod.skill ? 'grid-cols-2' : 'grid-cols-1')}>
              {wod.warmup && <WodSection icon={<Flame className="w-3.5 h-3.5" />} label="Warm Up" text={wod.warmup} />}
              {wod.skill && <WodSection icon={<Star className="w-3.5 h-3.5" />} label="Skill" text={wod.skill} />}
            </div>
          )}
          {wod.rx && <WodSection icon={<Timer className="w-3.5 h-3.5" />} label="RX" labelColor="text-primary" text={wod.rx} />}
          {wod.scaled && <WodSection icon={<Activity className="w-3.5 h-3.5" />} label="Scaled" labelColor="text-secondary" text={wod.scaled} />}

          <div className="mt-2">
            {submitted && !editing ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-primary">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-black text-sm">
                    {category} — {result}
                  </span>
                </div>
                <button onClick={() => setEditing(true)} className="flex items-center gap-2 text-xs text-on-surface-variant underline">
                  <Edit2 className="w-3.5 h-3.5" /> Editar resultado
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {/* Seleção de categoria */}
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest">Categoria</label>
                  <div className="grid grid-cols-2 gap-2">
                    {CATEGORY_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setCategory(opt.value as 'RX' | 'Scaled')}
                        disabled={submitting}
                        className={cn(
                          'py-3 rounded-2xl font-headline font-black text-sm uppercase tracking-widest transition-all border-2',
                          category === opt.value
                            ? `${opt.color} ${opt.border}`
                            : 'bg-surface-container-highest text-on-surface-variant border-transparent hover:border-outline-variant/30'
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Input de resultado */}
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest">Resultado</label>
                  {isTimeBased ? (
                    <TimeInput value={result} onChange={setResult} disabled={submitting} />
                  ) : isAmrap ? (
                    <AmrapInput
                      value={result}
                      onChange={setResult}
                      disabled={submitting}
                      repsPerRound={repsPerRound}
                    />
                  ) : (
                    <input type="number" inputMode="numeric" value={result}
                      onChange={(e) => setResult(e.target.value)}
                      placeholder="Total de reps" disabled={submitting}
                      className="w-full bg-surface-container-highest rounded-2xl p-4 text-center font-headline font-black text-4xl text-on-surface outline-none appearance-none"
                    />
                  )}
                </div>

                <button onClick={handleSubmit} disabled={submitting || !result.trim()}
                  className="w-full py-4 rounded-2xl bg-primary text-background font-black text-base disabled:opacity-40 transition-opacity">
                  {submitting ? 'Salvando…' : editing ? 'Atualizar' : 'Registrar resultado'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-center gap-2 text-xs text-on-surface-variant pt-2">
        <Trophy className="w-4 h-4" />
        <span>Complete o WOD para ganhar XP</span>
      </div>
    </div>
  );
}
