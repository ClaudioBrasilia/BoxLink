import { useState, useEffect, useRef } from 'react';
import { Calendar, Timer, Activity, Trophy, ChevronLeft, ChevronRight, Info, X, Edit2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { Wod as WodType, User } from '../types';
import { format, addDays, subDays, eachDayOfInterval, isSameDay } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

import { supabase } from '../lib/supabase';
import { addReward } from '../utils/rewards';

const TIMEZONE = 'America/Sao_Paulo';

// ─── Toast Component ───────────────────────────────────────────────────────────
type ToastType = 'success' | 'info' | 'warning' | 'error';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-[90vw] max-w-sm pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className={cn(
              'pointer-events-auto flex items-start gap-3 p-4 rounded-2xl shadow-xl border text-sm font-bold',
              t.type === 'success' && 'bg-primary text-background border-primary/50',
              t.type === 'info'    && 'bg-surface-container-low text-on-surface border-outline-variant/20',
              t.type === 'warning' && 'bg-secondary/20 text-secondary border-secondary/30',
              t.type === 'error'   && 'bg-red-500/10 text-red-400 border-red-500/30',
            )}
          >
            <span className="flex-1 leading-snug">{t.message}</span>
            <button
              onClick={() => onRemove(t.id)}
              className="opacity-60 hover:opacity-100 transition-opacity mt-0.5 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ─── Time Input Component ──────────────────────────────────────────────────────
function TimeInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}) {
  const parts = value.split(':');
  const initMin = parts[0] ?? '';
  const initSec = parts[1] ?? '';

  const [minutes, setMinutes] = useState(initMin);
  const [seconds, setSeconds] = useState(initSec);
  const secRef = useRef<HTMLInputElement>(null);

  const commit = (m: string, s: string) => {
    const mm = m.padStart(2, '0');
    const ss = s.padStart(2, '0');
    onChange(`${mm}:${ss}`);
  };

  const handleMinutes = (raw: string) => {
    const clean = raw.replace(/\D/g, '').slice(0, 2);
    setMinutes(clean);
    commit(clean, seconds);
    if (clean.length === 2) secRef.current?.focus();
  };

  const handleSeconds = (raw: string) => {
    const clean = raw.replace(/\D/g, '').slice(0, 2);
    const num = parseInt(clean, 10);
    const clamped = isNaN(num) ? clean : String(Math.min(num, 59));
    setSeconds(clamped);
    commit(minutes, clamped);
  };

  return (
    <div className="flex items-center gap-3 bg-surface-container-highest rounded-2xl p-4">
      <div className="flex-1 flex flex-col items-center gap-1">
        <label className="text-[8px] text-on-surface-variant font-black uppercase tracking-widest">MIN</label>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={99}
          value={minutes}
          onChange={(e) => handleMinutes(e.target.value)}
          placeholder="00"
          disabled={disabled}
          className="w-full bg-transparent text-center font-headline font-black text-4xl text-on-surface outline-none appearance-none"
        />
      </div>
      <span className="text-3xl font-black text-on-surface-variant">:</span>
      <div className="flex-1 flex flex-col items-center gap-1">
        <label className="text-[8px] text-on-surface-variant font-black uppercase tracking-widest">SEC</label>
        <input
          ref={secRef}
          type="number"
          inputMode="numeric"
          min={0}
          max={59}
          value={seconds}
          onChange={(e) => handleSeconds(e.target.value)}
          placeholder="00"
          disabled={disabled}
          className="w-full bg-transparent text-center font-headline font-black text-4xl text-on-surface outline-none appearance-none"
        />
      </div>
    </div>
  );
}

// ─── Main Wod Page ─────────────────────────────────────────────────────────────
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
  const [showInfo, setShowInfo] = useState(false);
  const [editing, setEditing] = useState(false);
  const [weekDays, setWeekDays] = useState<Date[]>([]);

  const addToast = (message: string, type: ToastType = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  };

  useEffect(() => {
    const today = new Date();
    const start = subDays(today, 3);
    const end = addDays(today, 3);
    setWeekDays(eachDayOfInterval({ start, end }));
  }, []);

  useEffect(() => {
    fetchWod();
  }, [selectedDate, user]);

  const fetchWod = async () => {
    if (!user) return;
    setLoading(true);
    setSubmitted(false);
    setExistingResultId(null);
    setResult('');

    const dateStr = formatInTimeZone(selectedDate, TIMEZONE, 'yyyy-MM-dd');

    const { data: wodData } = await supabase
      .from('wods')
      .select('*')
      .eq('date', dateStr)
      .maybeSingle();

    setWod(wodData ?? null);

    if (wodData) {
      const { data: resultData } = await supabase
        .from('wod_results')
        .select('*')
        .eq('wod_id', wodData.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (resultData) {
        setSubmitted(true);
        setExistingResultId(resultData.id);
        setResult(resultData.result ?? '');
      }
    }

    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!user || !wod || !result.trim()) return;
    setSubmitting(true);

    try {
      if (existingResultId) {
        await supabase
          .from('wod_results')
          .update({ result })
          .eq('id', existingResultId);
        addToast('Resultado atualizado!', 'success');
      } else {
        const { data } = await supabase
          .from('wod_results')
          .insert({ wod_id: wod.id, user_id: user.id, result })
          .select()
          .single();
        setExistingResultId(data?.id ?? null);
        await addReward(user.id, 'wod_complete', 10);
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
        addToast('WOD concluído! +10 XP 🎉', 'success');
      }
      setSubmitted(true);
      setEditing(false);
    } catch {
      addToast('Erro ao salvar resultado.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const isToday = isSameDay(selectedDate, new Date());

  return (
    <div className="flex flex-col gap-6 pb-24">
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
            <button
              key={day.toISOString()}
              onClick={() => setSelectedDate(day)}
              className={cn(
                'shrink-0 flex flex-col items-center justify-center w-12 h-14 rounded-2xl text-xs font-bold transition-all',
                active
                  ? 'bg-primary text-background'
                  : todayDay
                  ? 'bg-surface-container-highest text-primary'
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-black text-on-surface">
            {isToday ? 'WOD de Hoje' : format(selectedDate, "dd 'de' MMMM")}
          </h1>
        </div>
        {wod?.description && (
          <button onClick={() => setShowInfo((v) => !v)} className="p-1.5 rounded-xl bg-surface-container text-on-surface-variant">
            <Info className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Info Panel */}
      <AnimatePresence>
        {showInfo && wod?.description && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-surface-container rounded-2xl p-4 text-sm text-on-surface-variant leading-relaxed">
              {wod.description}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
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
        <div className="flex flex-col gap-4">
          {/* WOD Card */}
          <div className="bg-surface-container-low rounded-3xl p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Timer className="w-5 h-5 text-primary" />
              <span className="font-black text-on-surface text-base">{wod.title}</span>
            </div>
            {wod.movements && (
              <ul className="flex flex-col gap-1 text-sm text-on-surface-variant">
                {(wod.movements as string[]).map((m, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                    {m}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Result Input */}
          {submitted && !editing ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-primary">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-black text-sm">Resultado registrado: {result}</span>
              </div>
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-2 text-xs text-on-surface-variant underline"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Editar resultado
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {wod.type === 'time' ? (
                <TimeInput value={result} onChange={setResult} disabled={submitting} />
              ) : (
                <input
                  type="number"
                  inputMode="numeric"
                  value={result}
                  onChange={(e) => setResult(e.target.value)}
                  placeholder={wod.type === 'reps' ? 'Total de reps' : 'Peso (kg)'}
                  disabled={submitting}
                  className="w-full bg-surface-container-highest rounded-2xl p-4 text-center font-headline font-black text-4xl text-on-surface outline-none appearance-none"
                />
              )}
              <button
                onClick={handleSubmit}
                disabled={submitting || !result.trim()}
                className="w-full py-4 rounded-2xl bg-primary text-background font-black text-base disabled:opacity-40 transition-opacity"
              >
                {submitting ? 'Salvando…' : editing ? 'Atualizar' : 'Registrar resultado'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Trophy Footer */}
      <div className="flex items-center justify-center gap-2 text-xs text-on-surface-variant pt-2">
        <Trophy className="w-4 h-4" />
        <span>Complete o WOD para ganhar XP</span>
      </div>
    </div>
  );
}
