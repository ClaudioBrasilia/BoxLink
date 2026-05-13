import { useState, useEffect, useRef } from 'react';
import { Calendar, Timer, Activity, Trophy, ChevronLeft, ChevronRight, Flame, Star, Edit2, CheckCircle2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { Wod as WodType } from '../types';
import { format, addDays, subDays, eachDayOfInterval, isSameDay } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { supabase } from '../lib/supabase';
import { addReward } from '../utils/rewards';

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

export default function Wod() {
  const { user } = useAuth();
  const [wod, setWod] = useState<WodType | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [existingResultId, setExistingResultId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [editing, setEditing] = useState(false);
  const [weekDays, setWeekDays] = useState<Date[]>([]);

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

  const fetchWod = async () => {
    if (!user) return;
    setLoading(true); setSubmitted(false); setExistingResultId(null); setResult('');
    const dateStr = formatInTimeZone(selectedDate, TIMEZONE, 'yyyy-MM-dd');
    const { data: wodData } = await supabase.from('wods').select('*').eq('date', dateStr).maybeSingle();
    setWod(wodData ?? null);
    if (wodData) {
      const { data: resultData } = await supabase.from('wod_results').select('*')
        .eq('wod_id', wodData.id).eq('user_id', user.id).maybeSingle();
      if (resultData) { setSubmitted(true); setExistingResultId(resultData.id); setResult(resultData.result ?? ''); }
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!user || !wod || !result.trim()) return;
    setSubmitting(true);
    try {
      if (existingResultId) {
        await supabase.from('wod_results').update({ result }).eq('id', existingResultId);
        addToast('Resultado atualizado!', 'success');
      } else {
        const { data } = await supabase.from('wod_results')
          .insert({ wod_id: wod.id, user_id: user.id, result }).select().single();
        setExistingResultId(data?.id ?? null);
        await addReward(user.id, 'wod_complete', 10);
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
        addToast('WOD concluído! +10 XP 🎉', 'success');
      }
      setSubmitted(true); setEditing(false);
    } catch {
      addToast('Erro ao salvar resultado.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const isToday = isSameDay(selectedDate, new Date());

  return (
    <div className="flex flex-col gap-5 pb-24">
      <ToastContainer toasts={toasts} onRemove={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />

      {/* Date Selector */}
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

      {/* Header */}
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

          {/* Warm Up + Skill */}
          {(wod.warmup || wod.skill) && (
            <div className={cn('grid gap-3', wod.warmup && wod.skill ? 'grid-cols-2' : 'grid-cols-1')}>
              {wod.warmup && (
                <WodSection icon={<Flame className="w-3.5 h-3.5" />} label="Warm Up" text={wod.warmup} />
              )}
              {wod.skill && (
                <WodSection icon={<Star className="w-3.5 h-3.5" />} label="Skill" text={wod.skill} />
              )}
            </div>
          )}

          {/* RX */}
          {wod.rx && (
            <WodSection icon={<Timer className="w-3.5 h-3.5" />} label="RX" labelColor="text-primary" text={wod.rx} />
          )}

          {/* Scaled */}
          {wod.scaled && (
            <WodSection icon={<Activity className="w-3.5 h-3.5" />} label="Scaled" labelColor="text-secondary" text={wod.scaled} />
          )}

          {/* Beginner */}
          {wod.beginner && (
            <WodSection icon={<Activity className="w-3.5 h-3.5" />} label="Beginner" labelColor="text-on-surface-variant" text={wod.beginner} />
          )}

          {/* Result */}
          <div className="mt-2">
            {submitted && !editing ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-primary">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-black text-sm">Resultado registrado: {result}</span>
                </div>
                <button onClick={() => setEditing(true)} className="flex items-center gap-2 text-xs text-on-surface-variant underline">
                  <Edit2 className="w-3.5 h-3.5" />
                  Editar resultado
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {(() => {
                  const t = (wod.type ?? '').toLowerCase();
                  const isTime = t === 'time' || t === 'fortime' || t === 'for time';
                  const isWeight = t === 'weight' || t === 'max' || t === 'maxweight' || t === '1rm';
                  const placeholder = isWeight ? 'Peso (kg)' : 'Total de reps';
                  if (isTime) return <TimeInput value={result} onChange={setResult} disabled={submitting} />;
                  return (
                    <input type="number" inputMode="numeric" value={result}
                      onChange={(e) => setResult(e.target.value)}
                      placeholder={placeholder}
                      disabled={submitting}
                      className="w-full bg-surface-container-highest rounded-2xl p-4 text-center font-headline font-black text-4xl text-on-surface outline-none appearance-none"
                    />
                  );
                })()}
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
