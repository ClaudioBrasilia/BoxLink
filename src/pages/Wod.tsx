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
// Renders two separate number fields (MM : SS) for time-based WODs
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
          className="w-full bg-transparent text-center font-headline font-black text-4xl text-on-surface outline-none appearance-none disabled:opacity-50"
        />
      </div>
      <span className="font-headline font-black text-4xl text-primary pb-1">:</span>
      <div className="flex-1 flex flex-col items-center gap-1">
        <label className="text-[8px] text-on-surface-variant font-black uppercase tracking-widest">SEG</label>
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
          className="w-full bg-transparent text-center font-headline font-black text-4xl text-on-surface outline-none appearance-none disabled:opacity-50"
        />
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isTimeBased(type: string): boolean {
  return ['FOR TIME', 'TIME', 'TEMPO'].some((t) => type.toUpperCase().includes(t));
}

/**
 * Improvement #3 – Robust parse that handles missing leading zeros.
 * "9:45"  → 585   (same as "09:45")
 * "1:2:3" → 3723
 * "150"   → 150
 */
function parseResult(r: string, timeBased: boolean): number {
  if (!r) return timeBased ? 999999 : 0;
  const str = r.trim();

  if (/^\d+:\d+/.test(str)) {
    const parts = str.split(':').map((p) => parseInt(p, 10));
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  const num = parseFloat(str.replace(/[^0-9.]/g, ''));
  return isNaN(num) ? (timeBased ? 999999 : 0) : num;
}

/**
 * Normalises a time string so that "9:5" becomes "09:05", etc.
 * Applied before saving to keep ranking deterministic.
 */
function normaliseTimeResult(value: string): string {
  if (!/^\d+:\d+/.test(value.trim())) return value;
  const parts = value.trim().split(':').map((p) => p.padStart(2, '0'));
  return parts.join(':');
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function Wod() {
  const { user, updateUser } = useAuth();
  const [selectedDate, setSelectedDate]     = useState(new Date());
  const [wods, setWods]                     = useState<WodType[]>([]);
  const [currentWod, setCurrentWod]         = useState<WodType | null>(null);
  const [results, setResults]               = useState<any[]>([]);
  const [userResult, setUserResult]         = useState<any>(null);
  const [isRegistering, setIsRegistering]   = useState(false);
  const [isEditing, setIsEditing]           = useState(false);
  const [newResult, setNewResult]           = useState({ result: '', type: 'RX' });
  const [isSaving, setIsSaving]             = useState(false);
  const [hasCheckedExisting, setHasCheckedExisting] = useState(false);

  // ── Toast state ──
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const showToast = (message: string, type: ToastType = 'info', duration = 4000) => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration);
  };

  const removeToast = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  // ── Detect if current WOD is time-based ──
  const wodIsTimeBased = currentWod ? isTimeBased(currentWod.type) : false;

  // ── Fetch results ──────────────────────────────────────────────────────────
  const fetchResults = async (wodId: string) => {
    const { data: wod } = await supabase
      .from('wods')
      .select('type')
      .eq('id', wodId)
      .maybeSingle();

    const { data } = await supabase
      .from('wod_results')
      .select('*, profiles(name, level)')
      .eq('wod_id', wodId);

    const timeBased = isTimeBased(wod?.type || '');

    const sorted = (data || []).sort((a: any, b: any) =>
      timeBased
        ? parseResult(a.result, timeBased) - parseResult(b.result, timeBased)
        : parseResult(b.result, timeBased) - parseResult(a.result, timeBased),
    );

    setResults(sorted);

    if (user) {
      const userRes = sorted.find((r: any) => r.user_id === user.id);
      setUserResult(userRes || null);
      if (userRes) {
        setNewResult({ result: userRes.result, type: userRes.type });
      } else {
        setNewResult({ result: '', type: 'RX' });
      }
      setHasCheckedExisting(true);
    }
  };

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchWods = async () => {
      const { data } = await supabase.from('wods').select('*');
      setWods(data || []);

      const dateStr = formatInTimeZone(selectedDate, TIMEZONE, 'yyyy-MM-dd');
      const found = (data || []).find((w: any) => w.date === dateStr);
      setCurrentWod(found || null);
      setHasCheckedExisting(false);

      if (found) {
        fetchResults(found.id);
      } else {
        setResults([]);
        setUserResult(null);
      }
    };

    fetchWods();

    const channel = supabase
      .channel('wod_results_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wod_results' }, () => {
        if (currentWod) fetchResults(currentWod.id);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedDate, user]);

  // ── Register / Edit ──────────────────────────────────────────────────────
  const handleRegisterResult = async () => {
    if (!user || !currentWod || !newResult.result) {
      showToast('Por favor, preencha o resultado', 'warning');
      return;
    }

    if (isSaving) return;
    setIsSaving(true);

    // Normalise leading zeros before saving (Improvement #3)
    const normalisedResult = wodIsTimeBased
      ? normaliseTimeResult(newResult.result)
      : newResult.result;

    try {
      if (isEditing && userResult) {
        // ── Improvement #2: Edit feedback with XP reminder ──────────────────
        const { error } = await supabase
          .from('wod_results')
          .update({ result: normalisedResult, type: newResult.type })
          .eq('id', userResult.id);

        if (error) throw error;

        showToast('✅ Resultado atualizado no ranking!', 'success');
        showToast('💡 XP e BrazaCoins são concedidos apenas no primeiro registro do dia.', 'info', 6000);
        setIsEditing(false);

      } else {
        // ── Verificar se já registrou hoje ────────────────────────────────────
        const { data: existing } = await supabase
          .from('wod_results')
          .select('id')
          .eq('wod_id', currentWod.id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (existing) {
          showToast('Você já registrou um resultado para este WOD.', 'warning');
        } else {
          // ── Inserir resultado diretamente ─────────────────────────────────
          const { error: insertError } = await supabase
            .from('wod_results')
            .insert({
              user_id: user.id,
              wod_id: currentWod.id,
              result: normalisedResult,
              type: newResult.type,
            });

          if (insertError) throw insertError;

          // ── Conceder recompensas via addReward ────────────────────────────
          const reward = await addReward(
            user.id,
            'wod',
            30,
            10,
            `WOD registrado — ${currentWod.name}`,
            currentWod.id,
          );

          if (reward) {
            confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
            showToast(`🎉 Resultado registrado! +30 XP  •  +10 BrazaCoins`, 'success', 5000);

            if (reward.levelUp) {
              setTimeout(() => {
                confetti({ particleCount: 200, spread: 100, origin: { y: 0.5 }, colors: ['#CAFD00', '#FFFFFF'] });
              }, 500);
            }

            // ── Atualizar contexto do usuário ─────────────────────────────
            updateUser({
              ...user,
              xp: reward.newXp,
              coins: reward.newCoins,
              level: reward.newLevel,
            });
          }

          setIsRegistering(false);
        }
      }

      await fetchResults(currentWod.id);
    } catch (err: any) {
      console.error('Error:', err);
      showToast('Erro ao processar: ' + (err.message || 'Tente novamente'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const days = eachDayOfInterval({
    start: subDays(selectedDate, 3),
    end: addDays(selectedDate, 3),
  });

  //─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 p-4 pt-8 min-h-screen bg-background">
      {/* Global Toast layer */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <header className="flex justify-between items-center">
        <h1 className="text-3xl font-headline font-black text-on-surface tracking-tight uppercase italic flex items-center gap-3">
          <Timer className="w-8 h-8 text-primary" />
          WOD DIÁRIO
        </h1>
      </header>

      {/* Calendar Strip */}
      <div className="flex justify-between items-center bg-surface-container-low p-4 rounded-3xl border border-outline-variant/10 overflow-x-auto no-scrollbar gap-4">
        {days.map((day) => (
          <button
            key={day.toISOString()}
            onClick={() => setSelectedDate(day)}
            className={cn(
              'flex flex-col items-center gap-1 min-w-[50px] py-3 rounded-2xl transition-all',
              isSameDay(day, selectedDate)
                ? 'bg-primary text-background shadow-lg scale-110'
                : 'text-on-surface-variant hover:text-on-surface',
            )}
          >
            <span className="text-[8px] font-black uppercase tracking-widest">{format(day, 'EEE')}</span>
            <span className="text-lg font-headline font-black">{format(day, 'dd')}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={selectedDate.toISOString()}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="flex flex-col gap-6"
        >
          {currentWod ? (
            <>
              {/* WOD Header Card */}
              <div className="bg-surface-container-low rounded-[2.5rem] border border-outline-variant/10 p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6">
                  <span className="bg-primary/20 text-primary text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest border border-primary/30">
                    {currentWod.type}
                  </span>
                </div>
                <h2 className="text-5xl font-headline font-black text-on-surface italic uppercase tracking-tighter leading-none mb-2">
                  {currentWod.name}
                </h2>
                <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest mb-8">
                  {format(selectedDate, "dd 'de' MMMM 'de' yyyy")}
                </p>

                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h3 className="text-on-surface-variant text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
                      <Activity className="w-4 h-4 text-primary" /> WARM UP
                    </h3>
                    <p className="text-sm text-on-surface font-medium leading-relaxed opacity-80">{currentWod.warmup}</p>
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-on-surface-variant text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-secondary" /> SKILL
                    </h3>
                    <p className="text-sm text-on-surface font-medium leading-relaxed opacity-80">{currentWod.skill}</p>
                  </div>
                </div>
              </div>

              {/* Workout Details */}
              <div className="space-y-4">
                <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic flex items-center gap-2">
                  <Info className="w-5 h-5 text-primary" /> DETALHES DO TREINO
                </h3>
                <div className="space-y-3">
                  {[
                    { label: 'RX',       content: currentWod.rx,       color: 'text-primary',            bg: 'bg-primary/5' },
                    { label: 'SCALED',   content: currentWod.scaled,   color: 'text-secondary',          bg: 'bg-secondary/5' },
                    { label: 'BEGINNER', content: currentWod.beginner, color: 'text-on-surface-variant', bg: 'bg-surface-container-highest/30' },
                  ].map((item) => (
                    <div key={item.label} className={cn('p-6 rounded-3xl border border-outline-variant/10', item.bg)}>
                      <span className={cn('text-[10px] font-black uppercase tracking-widest block mb-2', item.color)}>{item.label}</span>
                      <p className="text-sm font-bold text-on-surface leading-relaxed">{item.content}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Seu Resultado (se já registrou) */}
              {userResult && !isEditing && hasCheckedExisting && (
                <div className="space-y-4">
                  <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary" /> SEU RESULTADO
                  </h3>
                  <div className="bg-primary/10 border-2 border-primary/30 p-6 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-headline font-black text-lg">
                        ✓
                      </div>
                      <div>
                        <p className="text-on-surface font-bold uppercase text-sm italic">Resultado Registrado</p>
                        <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">
                          {userResult.result} • {userResult.type}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsEditing(true)}
                      disabled={isSaving}
                      className="p-3 bg-primary/20 hover:bg-primary/30 rounded-xl transition-all flex items-center gap-2 text-primary font-headline font-bold text-sm uppercase disabled:opacity-50"
                    >
                      <Edit2 className="w-4 h-4" /> EDITAR
                    </button>
                  </div>
                </div>
              )}

              {/* ── Leaderboard ── */}
              <div className="space-y-4">
                <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-secondary" /> RESULTADOS DO DIA
                </h3>

                <div className="space-y-3">
                  {results.length > 0 ? (
                    results.map((res, i) => {
                      const isMe = res.user_id === user?.id;
                      return (
                        <div
                          key={res.id}
                          className={cn(
                            'p-4 rounded-2xl border flex items-center justify-between transition-all',
                            isMe
                              ? 'bg-primary/10 border-primary/50 shadow-[0_0_0_2px] shadow-primary/30'
                              : 'bg-surface-container-low border-outline-variant/10 hover:border-primary/30',
                          )}
                        >
                          <div className="flex items-center gap-4">
                            <span
                              className={cn(
                                'w-6 font-headline font-black text-xs italic',
                                isMe ? 'text-primary' : 'text-on-surface-variant',
                              )}
                            >
                              #{i + 1}
                            </span>

                            <div
                              className={cn(
                                'w-10 h-10 rounded-full flex items-center justify-center font-headline font-black text-sm',
                                isMe
                                  ? 'bg-primary text-background'
                                  : 'bg-surface-container-highest text-on-surface',
                              )}
                            >
                              {res.profiles?.name?.[0] || 'A'}
                            </div>

                            <div>
                              <p className={cn('font-bold uppercase text-sm italic flex items-center gap-2', isMe ? 'text-primary' : 'text-on-surface')}>
                                {res.profiles?.name || 'Atleta'}
                                {isMe && (
                                  <span className="text-[8px] font-black bg-primary text-background px-1.5 py-0.5 rounded-full tracking-widest">
                                    VOCÊ
                                  </span>
                                )}
                              </p>
                              <span
                                className={cn(
                                  'text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border',
                                  res.type === 'RX'
                                    ? 'bg-primary/20 text-primary border-primary/30'
                                    : res.type === 'SCALED'
                                    ? 'bg-secondary/20 text-secondary border-secondary/30'
                                    : 'bg-surface-container-highest text-on-surface-variant border-outline-variant/10',
                                )}
                              >
                                {res.type}
                              </span>
                            </div>
                          </div>

                          <span
                            className={cn(
                              'font-headline font-black text-lg italic',
                              isMe ? 'text-primary' : 'text-on-surface-variant',
                            )}
                          >
                            {res.result}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="bg-surface-container-low p-8 rounded-3xl border border-outline-variant/10 text-center">
                      <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest opacity-50 italic">
                        Nenhum resultado registrado ainda
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {!userResult && !isEditing && hasCheckedExisting && (
                <button
                  onClick={() => setIsRegistering(true)}
                  disabled={isSaving}
                  className="w-full bg-primary text-background py-5 rounded-2xl font-headline font-black text-lg shadow-lg uppercase italic tracking-tight flex items-center justify-center gap-2 mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  REGISTRAR RESULTADO <ChevronRight className="w-5 h-5" />
                </button>
              )}
            </>
          ) : (
            <div className="bg-surface-container-low p-12 rounded-[2.5rem] border border-outline-variant/10 text-center flex flex-col items-center gap-4">
              <Calendar className="w-12 h-12 text-on-surface-variant opacity-20" />
              <p className="text-on-surface-variant font-headline font-bold uppercase italic tracking-widest">
                Nenhum WOD encontrado para esta data
              </p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* ── Register / Edit Modal ── */}
      <AnimatePresence>
        {(isRegistering || isEditing) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-md bg-surface-container-low rounded-[2.5rem] border border-outline-variant/10 p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-headline font-bold text-xl text-on-surface uppercase italic">
                  {isEditing ? 'EDITAR RESULTADO' : 'REGISTRAR RESULTADO'}
                </h3>
                <button
                  onClick={() => { setIsRegistering(false); setIsEditing(false); }}
                  className="p-2 hover:bg-surface-container-highest rounded-xl transition-all"
                  disabled={isSaving}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest flex items-center gap-2">
                    Seu Resultado
                    {wodIsTimeBased && (
                      <span className="text-[8px] bg-primary/20 text-primary px-2 py-0.5 rounded-full border border-primary/30 font-black tracking-widest uppercase">
                        ⏱ Tempo
                      </span>
                    )}
                  </label>

                  {wodIsTimeBased ? (
                    <TimeInput
                      value={newResult.result}
                      onChange={(val) => setNewResult({ ...newResult, result: val })}
                      disabled={isSaving}
                    />
                  ) : (
                    <input
                      type="text"
                      value={newResult.result}
                      onChange={(e) => setNewResult({ ...newResult, result: e.target.value })}
                      placeholder="ex: 150 reps ou 100kg"
                      className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface"
                      disabled={isSaving}
                    />
                  )}
                </div>

                {/* Category selector */}
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Categoria</label>
                  <div className="flex gap-2">
                    {['RX', 'SCALED', 'BEGINNER'].map((t) => (
                      <button
                        key={t}
                        onClick={() => setNewResult({ ...newResult, type: t })}
                        disabled={isSaving}
                        className={cn(
                          'flex-1 py-3 rounded-xl font-headline font-bold text-[10px] uppercase tracking-widest transition-all disabled:opacity-50',
                          newResult.type === t
                            ? 'bg-primary text-background shadow-lg'
                            : 'bg-surface-container-highest text-on-surface-variant',
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Editing reminder banner */}
                {isEditing && (
                  <div className="bg-secondary/10 border border-secondary/30 rounded-2xl p-3 flex items-start gap-2">
                    <Info className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
                    <p className="text-secondary text-[10px] font-bold uppercase tracking-widest leading-relaxed">
                      Editar atualiza apenas o ranking. XP e BrazaCoins são concedidos somente no primeiro registro do dia.
                    </p>
                  </div>
                )}

                {/* Submit */}
                <button
                  onClick={handleRegisterResult}
                  disabled={isSaving}
                  className={cn(
                    'w-full py-4 rounded-2xl font-headline font-black uppercase italic shadow-lg mt-4 transition-all flex items-center justify-center gap-2',
                    isSaving
                      ? 'bg-surface-container-highest text-on-surface-variant cursor-not-allowed'
                      : 'bg-primary text-background hover:opacity-90',
                  )}
                >
                  {isSaving && (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  )}
                  {isSaving ? 'SALVANDO...' : isEditing ? 'ATUALIZAR RESULTADO' : 'SALVAR RESULTADO'}
                </button>

                <button
                  onClick={() => { setIsRegistering(false); setIsEditing(false); }}
                  disabled={isSaving}
                  className="w-full bg-surface-container-highest text-on-surface py-3 rounded-2xl font-headline font-bold uppercase italic shadow-sm disabled:opacity-50"
                >
                  CANCELAR
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
