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

// (as funções TimeInput, parseLines, MovementRow, WodSection permanecem as mesmas do seu código original)

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
      }
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
        const { data: settingsData } = await supabase.from('app_settings').select('rewards').eq('id', 1).single();
        const wodXp = settingsData?.rewards?.wod_xp ?? 10;
        const wodCoins = settingsData?.rewards?.wod_coins ?? 5;
        await addReward(user.id, 'wod_complete', wodXp, wodCoins, 'WOD concluído', wod.id);
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
        addToast(`WOD concluído! +\( {wodXp} XP e + \){wodCoins} BrazaCoins 🎉`, 'success');
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
    <div className="flex flex-col gap-5 pb-24 relative min-h-screen">
      <ToastContainer toasts={toasts} onRemove={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />

      {/* Date Selector, Header, WOD content... (mesmo conteúdo que você já tinha) */}

      <div className="flex items-center justify-center gap-2 text-xs text-on-surface-variant pt-2">
        <Trophy className="w-4 h-4" />
        <span>Complete o WOD para ganhar XP</span>
      </div>
    </div>
  );
}
