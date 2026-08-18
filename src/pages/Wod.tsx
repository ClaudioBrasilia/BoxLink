import { useState, useEffect } from 'react';
import { Calendar, Timer, Activity, Trophy, ChevronLeft, ChevronRight, Flame, Star, Edit2, CheckCircle2, X, Lock, Dumbbell, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { Wod as WodType } from '../types';
import { format, addDays, subDays, eachDayOfInterval, isSameDay } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { supabase } from '../lib/supabase';
import { getWodByDate, getLatestWod } from '../lib/wods';
import { addReward, getRewardSettings } from '../utils/rewards';
import { calcInactivity, InactivitySettings, InactivityState } from '../utils/inactivity';
import PostWorkoutFeedback from '../components/PostWorkoutFeedback';
import PostWorkoutInsight from '../components/PostWorkoutInsight';
import TimeInput from '../components/TimeInput';
import AmrapInput from '../components/AmrapInput';
import { TrainingFeeling } from '../types';
import { assessHrSessionQuality, fetchRecentHeartRateSessions, HrSessionQuality, linkHeartRateSessionToWodResult } from '../lib/heartRateSessions';
import { effortFromSession, WodEffort } from '../lib/effort';
import { useUserBiometrics } from '../hooks/useUserBiometrics';

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
  const [loadKg, setLoadKg] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [existingResultId, setExistingResultId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [editing, setEditing] = useState(false);
  const [weekDays, setWeekDays] = useState<Date[]>([]);
  const [inactivity, setInactivity] = useState<InactivityState | null>(null);
  const [inactivityLoading, setInactivityLoading] = useState(true);

  // Esforço (FC) que acompanha o resultado. Vem da última sessão medida na
  // tela de Frequência: o Box não tem cronômetro que colete as amostras, então
  // o caminho é medir a FC lá e registrar o resultado aqui. É o dado que
  // libera a 4ª barra ("Esforço") na comparação entre atletas.
  const bio = useUserBiometrics(user?.id);
  // O que já está gravado neste resultado (o que a comparação usa hoje).
  const [savedEffort, setSavedEffort] = useState<WodEffort | null>(null);
  // O que a sessão recente de FC tem a oferecer, ainda não gravado.
  const [sessionEffort, setSessionEffort] = useState<WodEffort | null>(null);
  const [sessionQuality, setSessionQuality] = useState<HrSessionQuality | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionCandidateCount, setSessionCandidateCount] = useState(0);

  // Percepção de esforço — aparece a cada vez que o resultado é salvo
  // (registrado ou editado), mesmo padrão do Diário no modo Individual.
  const [showFeedback, setShowFeedback] = useState(false);
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [fbRpe, setFbRpe] = useState(0);
  const [fbFeeling, setFbFeeling] = useState<TrainingFeeling | null>(null);
  const [fbSleepHours, setFbSleepHours] = useState('');
  const [fbNotes, setFbNotes] = useState('');
  const [recentBaseline, setRecentBaseline] = useState<{
    avgRpe: number;
    avgSleep: number;
    rpeCount: number;
    sleepCount: number;
  } | null>(null);

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

  // Baseline opcional dos últimos 28 dias. A consulta é independente do
  // salvamento do WOD e, se falhar, o cartão continua usando as regras locais.
  useEffect(() => {
    if (!user?.id) { setRecentBaseline(null); return; }
    let cancelled = false;
    const since = subDays(new Date(), 28).toISOString();
    supabase
      .from('wod_results')
      .select('rpe, sleep_hours')
      .eq('user_id', user.id)
      .gte('created_at', since)
      .limit(50)
      .then(({ data }) => {
        if (cancelled) return;
        const rpeValues = (data || [])
          .map(row => Number(row.rpe))
          .filter(value => Number.isFinite(value) && value > 0);
        const sleepValues = (data || [])
          .map(row => Number(row.sleep_hours))
          .filter(value => Number.isFinite(value) && value > 0);
        setRecentBaseline({
          avgRpe: rpeValues.length ? rpeValues.reduce((sum, value) => sum + value, 0) / rpeValues.length : 0,
          avgSleep: sleepValues.length ? sleepValues.reduce((sum, value) => sum + value, 0) / sleepValues.length : 0,
          rpeCount: rpeValues.length,
          sleepCount: sleepValues.length,
        });
      })
      .catch(() => { if (!cancelled) setRecentBaseline(null); });
    return () => { cancelled = true; };
  }, [user?.id]);

  // Atualiza em tempo real quando o coach posta ou edita o WOD (sem precisar sair da aba)
  useEffect(() => {
    const channel = supabase
      .channel('wod_page_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wods' }, () => fetchWod())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wod_results' }, () => fetchWod())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedDate, user]);

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
    setLoading(true); setSubmitted(false); setExistingResultId(null); setResult(''); setLoadKg(''); setSavedEffort(null);
    const dateStr = formatInTimeZone(selectedDate, TIMEZONE, 'yyyy-MM-dd');
    let wodData = await getWodByDate(dateStr);
    if (!wodData && isSameDay(selectedDate, new Date())) {
      wodData = await getLatestWod(dateStr);
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
        setLoadKg(resultData.load_kg != null ? String(resultData.load_kg) : '');
        if (resultData.hr_avg_pct != null || resultData.effort_index != null || resultData.hr_zone != null) {
          setSavedEffort({
            hrAvgPct: resultData.hr_avg_pct ?? null,
            effortIndex: resultData.effort_index ?? null,
            hrZone: resultData.hr_zone ?? null,
          });
        }
      }
    }
    setLoading(false);
  };

  // Sessão de FC recente do atleta — só faz sentido no WOD de hoje: registrar
  // o resultado de um treino de terça não deve pegar a FC medida agora.
  useEffect(() => {
    if (!user?.id || !isSameDay(selectedDate, new Date())) {
      setSessionEffort(null);
      setSessionQuality(null);
      setSessionId(null);
      setSessionCandidateCount(0);
      return;
    }
    let cancelled = false;
    fetchRecentHeartRateSessions(user.id).then(sessions => {
      if (cancelled) return;
      const validCandidates = sessions.filter(session => assessHrSessionQuality(session).usableForWod);
      setSessionCandidateCount(validCandidates.length);
      if (validCandidates.length === 1) {
        const candidate = validCandidates[0];
        setSessionId(candidate.id);
        setSessionQuality(assessHrSessionQuality(candidate));
        setSessionEffort(effortFromSession(candidate, bio));
        return;
      }
      setSessionId(null);
      setSessionEffort(null);
      setSessionQuality(sessions[0] ? assessHrSessionQuality(sessions[0]) : null);
    });
    return () => { cancelled = true; };
  }, [user?.id, selectedDate, bio]);

  const handleSubmit = async () => {
    if (!user || !wod || !result.trim()) return;
    // Carga é opcional: campo vazio (ou inválido) grava null, não zero.
    const parsedLoad = loadKg.trim() ? parseFloat(loadKg.replace(',', '.')) : NaN;
    const parsedLoadKg = Number.isFinite(parsedLoad) && parsedLoad > 0 ? parsedLoad : null;
    // Esforço medido hoje entra junto do resultado. Sem faixa conectada
    // (ou fora da janela) o campo nem vai no payload: editar um resultado não
    // pode apagar o esforço que já estava gravado nele.
    const effortPayload = sessionEffort
      ? { hr_avg_pct: sessionEffort.hrAvgPct, effort_index: sessionEffort.effortIndex, hr_zone: sessionEffort.hrZone }
      : {};
    setSubmitting(true);
    try {
      if (existingResultId) {
        const { data, error } = await supabase.from('wod_results')
          .update({ result, type: category, load_kg: parsedLoadKg, ...effortPayload })
          .eq('id', existingResultId)
          .select('rpe, feeling, sleep_hours, notes')
          .single();
        if (error) throw error;
        if (sessionId) await linkHeartRateSessionToWodResult(existingResultId, sessionId);
        addToast('Resultado atualizado!', 'success');
        // Editar também pode mudar como o treino foi — mesmo comportamento
        // do Diário no Individual, onde o card aparece a cada registro. Vem
        // pré-preenchido com o que já tinha sido respondido, pra não sumir
        // com RPE/sensação salvos antes só por reabrir o card em branco.
        setFbRpe(data?.rpe ?? 0);
        setFbFeeling(data?.feeling ?? null);
        setFbSleepHours(data?.sleep_hours != null ? String(data.sleep_hours) : '');
        setFbNotes(data?.notes ?? '');
        setShowFeedback(true);
      } else {
        const { data, error } = await supabase.from('wod_results')
          .insert({ wod_id: wod.id, user_id: user.id, result, type: category, load_kg: parsedLoadKg, ...effortPayload })
          .select().single();
        if (error) throw error;
        setExistingResultId(data.id);
        if (sessionId) await linkHeartRateSessionToWodResult(data.id, sessionId);

        // Resultado já está salvo — mostra a percepção de esforço mesmo que a
        // recompensa (XP/coins) falhe abaixo. Eram a mesma tentativa/catch
        // antes, então uma falha ao calcular XP jogava um "erro ao salvar"
        // enganoso (o resultado tinha salvo!) e nunca abria esse card.
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
        setShowFeedback(true);

        try {
          const rewards = await getRewardSettings();
          const wodXp    = rewards.wod_xp    ?? 10;
          const wodCoins = rewards.wod_coins  ?? 5;

          const rewardResult = await addReward(user.id, 'wod_complete', wodXp, wodCoins, 'WOD concluído', wod.id);
          let msg = `WOD concluído! +${wodXp} XP e +${wodCoins} BrazaCoins 🎉`;
          if (rewardResult?.levelUp) {
            msg += ` ⬆️ LEVEL UP! Nível ${rewardResult.newLevel}!`;
            setTimeout(() => confetti({ particleCount: 200, spread: 100, origin: { y: 0.5 }, colors: ['#CAFD00', '#FFFFFF'] }), 400);
          }
          addToast(msg, 'success');
        } catch (rewardErr) {
          console.error('Error granting WOD reward:', rewardErr);
          addToast('Resultado salvo!', 'success');
        }
      }
      if (sessionEffort) setSavedEffort(sessionEffort);
      setSubmitted(true); setEditing(false);
    } catch (err) {
      console.error('Error saving WOD result:', err);
      addToast('Erro ao salvar resultado.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const closeFeedback = () => {
    setShowFeedback(false);
    setFbRpe(0); setFbFeeling(null); setFbSleepHours(''); setFbNotes('');
  };

  const saveFeedback = async () => {
    if (!existingResultId) { closeFeedback(); return; }
    setSavingFeedback(true);
    try {
      await supabase.from('wod_results').update({
        rpe: fbRpe > 0 ? fbRpe : null,
        feeling: fbFeeling,
        sleep_hours: fbSleepHours ? parseFloat(fbSleepHours.replace(',', '.')) : null,
        notes: fbNotes.trim() || null,
      }).eq('id', existingResultId);
      addToast('Detalhes salvos!', 'success');
    } catch {
      addToast('Erro ao salvar detalhes.', 'error');
    } finally {
      setSavingFeedback(false);
      closeFeedback();
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

      <AnimatePresence>
        {showFeedback && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[65] bg-background flex flex-col"
          >
            <div className="flex items-center justify-between p-6 pt-12">
              <h2 className="font-headline font-black text-lg text-on-surface uppercase italic">Percepção de Esforço</h2>
              <button onClick={closeFeedback} className="w-9 h-9 rounded-full bg-surface-container-highest flex items-center justify-center">
                <X className="w-5 h-5 text-on-surface-variant" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-8 flex flex-col gap-5">
              <div className="bg-primary/10 border border-primary/20 rounded-2xl px-4 py-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                <p className="text-[11px] text-on-surface font-bold leading-snug">
                  Resultado registrado! Como foi o treino pra você?
                </p>
              </div>

              <PostWorkoutFeedback
                rpe={fbRpe} onRpeChange={setFbRpe}
                feeling={fbFeeling} onFeelingChange={setFbFeeling}
                sleepHours={fbSleepHours} onSleepHoursChange={setFbSleepHours}
                notes={fbNotes} onNotesChange={setFbNotes}
              />
              {(fbRpe > 0 || fbFeeling !== null || fbSleepHours.trim() !== '') && (
                <PostWorkoutInsight
                  rpe={fbRpe}
                  feeling={fbFeeling}
                  sleepHours={fbSleepHours}
                  baseline={recentBaseline}
                />
              )}
              <button
                onClick={saveFeedback}
                disabled={savingFeedback}
                className="w-full bg-primary text-background py-4 rounded-2xl font-headline font-black text-sm uppercase italic shadow-lg flex items-center justify-center gap-2 disabled:opacity-40 hover:opacity-90 transition-all"
              >
                {savingFeedback
                  ? <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin" />
                  : <CheckCircle2 className="w-5 h-5" />}
                SALVAR
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                    {loadKg && <span className="text-on-surface-variant font-bold"> · {loadKg}kg</span>}
                  </span>
                </div>
                {savedEffort && (
                  <div className="flex items-center gap-2 text-secondary">
                    <Heart className="w-4 h-4 shrink-0" />
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      {[
                        savedEffort.hrAvgPct != null ? `${savedEffort.hrAvgPct}% FCmáx` : null,
                        savedEffort.effortIndex != null ? `Esforço ${savedEffort.effortIndex}` : null,
                        savedEffort.hrZone,
                      ].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                )}
                {/* Sem a carga o atleta fica de fora da força relativa. Como o
                    campo vive no formulário, quem já registrou o resultado não
                    o veria — este atalho abre a edição já apontando o que falta. */}
                {!loadKg && (
                  <button onClick={() => setEditing(true)}
                    className="flex items-center gap-2 bg-secondary/10 border border-secondary/20 rounded-2xl px-4 py-2.5 text-left">
                    <Dumbbell className="w-4 h-4 text-secondary shrink-0" />
                    <span className="text-[10px] font-black text-secondary uppercase tracking-widest leading-snug">
                      Usou carga? Registre para entrar na força relativa
                    </span>
                  </button>
                )}
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

                {/* Carga usada (opcional) — vira força relativa (carga ÷ peso
                    corporal) no ranking e nas comparações. Fica de fora quando
                    o WOD não tem carga (corrida, burpee). */}
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest">
                    Carga usada <span className="opacity-50">(opcional)</span>
                  </label>
                  <div className="flex items-center gap-2 bg-surface-container-highest rounded-2xl px-4 py-3">
                    <Dumbbell className="w-4 h-4 text-secondary shrink-0" />
                    <input type="number" inputMode="decimal" min={0} step="0.5" value={loadKg}
                      onChange={(e) => setLoadKg(e.target.value)}
                      placeholder="Ex: 43" disabled={submitting}
                      className="flex-1 bg-transparent font-bold text-on-surface outline-none appearance-none placeholder:text-on-surface-variant/40 placeholder:font-medium"
                    />
                    <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">kg</span>
                  </div>
                  <p className="text-[9px] text-on-surface-variant/70 font-bold uppercase tracking-widest leading-snug">
                    Com seu peso no perfil, mostra quanto do próprio corpo você moveu
                  </p>
                </div>

                {/* Esforço (FC): não é um campo pra digitar — ou existe uma
                    medição recente pra anexar, ou o atleta fica sem a barra de
                    esforço na comparação. Os dois casos são ditos aqui. */}
                {sessionEffort ? (
                  <div className="flex items-center gap-2 bg-secondary/10 border border-secondary/20 rounded-2xl px-4 py-2.5">
                    <Heart className="w-4 h-4 text-secondary shrink-0" />
                    <span className="text-[10px] font-black text-secondary uppercase tracking-widest leading-snug">
                      Esforço da sua medição de FC vai junto
                      {sessionEffort.hrAvgPct != null ? ` — ${sessionEffort.hrAvgPct}% FCmáx` : ''}
                    </span>
                  </div>
                ) : sessionCandidateCount > 1 ? (
                  <div className="flex items-center gap-2 bg-secondary/10 border border-secondary/20 rounded-2xl px-4 py-2.5">
                    <Heart className="w-4 h-4 text-secondary shrink-0" />
                    <span className="text-[10px] font-black text-secondary uppercase tracking-widest leading-snug">
                      {sessionCandidateCount} medições válidas recentes. Nenhuma foi vinculada automaticamente para evitar associação incorreta.
                    </span>
                  </div>
                ) : sessionQuality ? (
                  <div className="flex items-center gap-2 bg-secondary/10 border border-secondary/20 rounded-2xl px-4 py-2.5">
                    <Heart className="w-4 h-4 text-secondary shrink-0" />
                    <span className="text-[10px] font-black text-secondary uppercase tracking-widest leading-snug">
                      Medição recente não vinculada: {sessionQuality.reason} Faça uma sessão mais longa para entrar na comparação.
                    </span>
                  </div>
                ) : (
                  <Link to="/frequencia"
                    className="flex items-center gap-2 bg-surface-container-highest rounded-2xl px-4 py-2.5">
                    <Heart className="w-4 h-4 text-on-surface-variant shrink-0" />
                    <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest leading-snug">
                      Meça a FC em Frequência para entrar na comparação de esforço
                    </span>
                  </Link>
                )}

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
