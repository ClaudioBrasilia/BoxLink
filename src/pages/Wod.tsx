import { useState, useEffect } from 'react';
import { Calendar, Timer, Activity, Trophy, ChevronLeft, ChevronRight, Info, X, Edit2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { Wod as WodType } from '../types';
import { format, addDays, subDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { motion, AnimatePresence } from 'framer-motion';

import { supabase } from '../lib/supabase';
import { addReward } from '../utils/rewards';

const TIMEZONE = 'America/Sao_Paulo';

export default function Wod() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [wods, setWods] = useState<WodType[]>([]);
  const [currentWod, setCurrentWod] = useState<WodType | null>(null);
  const [results, setResults] = useState<any[]>([]);
  const [userResult, setUserResult] = useState<any>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newResult, setNewResult] = useState({ result: '', type: 'RX' });
  const [isSaving, setIsSaving] = useState(false);

  const parseResult = (r: string, isTimeBased: boolean): number => {
    if (!r) return isTimeBased ? 999999 : 0;
    const str = r.trim();
    if (/^\d+:\d+/.test(str)) {
      const p = str.split(':').map(Number);
      return p.length === 2 ? p[0] * 60 + p[1] : p[0] * 3600 + p[1] * 60 + p[2];
    }
    return parseFloat(str.replace(/[^0-9.]/g, '')) || (isTimeBased ? 999999 : 0);
  };

  const fetchResults = async (wodId: string) => {
    // Busca o tipo do WOD para saber se é por tempo ou por reps
    const { data: wod } = await supabase
      .from('wods')
      .select('type')
      .eq('id', wodId)
      .maybeSingle();

    const { data } = await supabase
      .from('wod_results')
      .select('*, profiles(name)')
      .eq('wod_id', wodId);

    const isTimeBased = ['FOR TIME', 'TIME', 'TEMPO'].some(
      t => (wod?.type || '').toUpperCase().includes(t)
    );

    // Deduplicar: mantém apenas o melhor resultado por usuário
    const bestByUser: Record<string, any> = {};
    (data || []).forEach((r: any) => {
      const val = parseResult(r.result, isTimeBased);
      const prev = bestByUser[r.user_id];
      if (!prev) {
        bestByUser[r.user_id] = r;
        return;
      }
      const prevVal = parseResult(prev.result, isTimeBased);
      const isBetter = isTimeBased ? val < prevVal : val > prevVal;
      if (isBetter) bestByUser[r.user_id] = r;
    });

    // Ordena por melhor resultado
    const sorted = Object.values(bestByUser).sort((a: any, b: any) =>
      isTimeBased
        ? parseResult(a.result, isTimeBased) - parseResult(b.result, isTimeBased)
        : parseResult(b.result, isTimeBased) - parseResult(a.result, isTimeBased)
    );

    setResults(sorted);

    // Buscar resultado do usuário atual
    if (user) {
      const userRes = sorted.find((r: any) => r.user_id === user.id);
      setUserResult(userRes || null);
      if (userRes) {
        setNewResult({ result: userRes.result, type: userRes.type });
      } else {
        setNewResult({ result: '', type: 'RX' });
      }
    }
  };

  useEffect(() => {
    const fetchWods = async () => {
      const { data } = await supabase.from('wods').select('*');
      setWods(data || []);
      
      const dateStr = formatInTimeZone(selectedDate, TIMEZONE, 'yyyy-MM-dd');
      const found = (data || []).find((w: any) => w.date === dateStr);
      setCurrentWod(found || null);
      if (found) {
        fetchResults(found.id);
      } else {
        setResults([]);
        setUserResult(null);
      }
    };
    fetchWods();
  }, [selectedDate, user]);

  const handleRegisterResult = async () => {
    if (!user || !currentWod || !newResult.result) {
      alert('Por favor, preencha o resultado');
      return;
    }

    setIsSaving(true);
    const isFirstTime = !userResult;

    try {
      const { error } = await supabase
        .from('wod_results')
        .upsert({
          user_id: user.id,
          wod_id: currentWod.id,
          result: newResult.result,
          type: newResult.type,
          rewarded: isFirstTime ? true : (userResult?.rewarded ?? false)
        }, { onConflict: 'user_id,wod_id' });

      if (!error) {
        // Só dá recompensa no primeiro registro, nunca na edição
        if (isFirstTime) {
          const { data: economy } = await supabase
            .from('avatar_economy_settings')
            .select('*')
            .eq('is_active', true)
            .single();
          const xp = economy?.xp_per_wod || 30;
          const coins = economy?.coins_per_wod || 10;
          await addReward(user.id, 'wod', xp, coins, `WOD: ${currentWod.name}`);
          alert(`Resultado registrado! +${xp} XP, +${coins} BrazaCoins`);
        } else {
          alert('Resultado atualizado com sucesso!');
        }

        setIsRegistering(false);
        setIsEditing(false);
        await fetchResults(currentWod.id);
      } else {
        console.error('Error registering result:', error);
        alert('Erro ao registrar resultado: ' + error.message);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditClick = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    if (userResult) {
      setNewResult({ result: userResult.result, type: userResult.type });
    } else {
      setNewResult({ result: '', type: 'RX' });
    }
  };

  const days = eachDayOfInterval({
    start: subDays(selectedDate, 3),
    end: addDays(selectedDate, 3),
  });

  return (
    <div className="flex flex-col gap-6 p-4 pt-8 min-h-screen bg-background">
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
              "flex flex-col items-center gap-1 min-w-[50px] py-3 rounded-2xl transition-all",
              isSameDay(day, selectedDate) ? "bg-primary text-background shadow-lg scale-110" : "text-on-surface-variant hover:text-on-surface"
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
                <h2 className="text-5xl font-headline font-black text-on-surface italic uppercase tracking-tighter leading-none mb-2">{currentWod.name}</h2>
                <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest mb-8">{format(selectedDate, "dd 'de' MMMM 'de' yyyy")}</p>

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
                    { label: 'RX', content: currentWod.rx, color: 'text-primary', bg: 'bg-primary/10' },
                    { label: 'SCALED', content: currentWod.scaled, color: 'text-secondary', bg: 'bg-secondary/10' },
                    { label: 'BEGINNER', content: currentWod.beginner, color: 'text-on-surface-variant', bg: 'bg-surface-container-highest/30' },
                  ].map((item) => (
                    <div key={item.label} className={cn("p-6 rounded-3xl border border-outline-variant/10", item.bg)}>
                      <span className={cn("text-[10px] font-black uppercase tracking-widest block mb-2", item.color)}>{item.label}</span>
                      <p className="text-sm font-bold text-on-surface leading-relaxed">{item.content}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Seu Resultado (se já registrou) */}
              {userResult && !isEditing && (
                <div className="space-y-4">
                  <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-primary" /> SEU RESULTADO
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
                      onClick={handleEditClick}
                      className="p-3 bg-primary/20 hover:bg-primary/30 rounded-xl transition-all flex items-center gap-2 text-primary font-headline font-bold text-sm uppercase"
                    >
                      <Edit2 className="w-4 h-4" /> EDITAR
                    </button>
                  </div>
                </div>
              )}

              {/* Leaderboard for this WOD */}
              <div className="space-y-4">
                <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-secondary" /> RESULTADOS DO DIA
                </h3>
                
                <div className="space-y-3">
                  {results.length > 0 ? results.map((res, i) => (
                    <div key={res.id} className={cn("bg-surface-container-low p-4 rounded-2xl border border-outline-variant/10 flex items-center justify-between group hover:border-primary/30 transition-all", res.user_id === user?.id && "border-primary/50 bg-primary/5")}>
                      <div className="flex items-center gap-4">
                        <span className="w-6 text-on-surface-variant font-headline font-black text-xs italic">#{i + 1}</span>
                        <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-on-surface font-headline font-black text-sm", res.user_id === user?.id ? "bg-primary/20 text-primary" : "bg-surface-container-highest")}>
                          {res.profiles?.name?.[0] || 'A'}
                        </div>
                        <div>
                          <p className="text-on-surface font-bold uppercase text-sm italic">{res.profiles?.name || 'Atleta'} {res.user_id === user?.id && <span className="text-primary text-[10px] font-black">(VOCÊ)</span>}</p>
                          <span className={cn(
                            "text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border",
                            res.type === 'RX' ? "bg-primary/20 text-primary border-primary/30" : res.type === 'SCALED' ? "bg-secondary/20 text-secondary border-secondary/30" : "bg-surface-container-highest text-on-surface-variant border-outline-variant/10"
                          )}>
                            {res.type}
                          </span>
                        </div>
                      </div>
                      <span className="text-primary font-headline font-black text-lg italic">{res.result}</span>
                    </div>
                  )) : (
                    <div className="bg-surface-container-low p-8 rounded-3xl border border-outline-variant/10 text-center">
                      <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest opacity-50 italic">Nenhum resultado registrado ainda</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Button */}
              {!userResult && !isEditing && (
                <button 
                  onClick={() => setIsRegistering(true)}
                  className="w-full bg-primary text-background py-5 rounded-2xl font-headline font-black text-lg shadow-lg uppercase italic tracking-tight flex items-center justify-center gap-2 mt-4"
                >
                  REGISTRAR RESULTADO <ChevronRight className="w-5 h-5" />
                </button>
              )}
            </>
          ) : (
            <div className="bg-surface-container-low p-12 rounded-[2.5rem] border border-outline-variant/10 text-center flex flex-col items-center gap-4">
              <Calendar className="w-12 h-12 text-on-surface-variant opacity-20" />
              <p className="text-on-surface-variant font-headline font-bold uppercase italic tracking-widest">Nenhum WOD encontrado para esta data</p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Register Modal */}
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
                  onClick={() => {
                    setIsRegistering(false);
                    handleCancelEdit();
                  }} 
                  className="p-2 hover:bg-surface-container-highest rounded-xl transition-all"
                  disabled={isSaving}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Seu Resultado</label>
                  <input 
                    type="text" 
                    value={newResult.result} 
                    onChange={e => setNewResult({...newResult, result: e.target.value})}
                    placeholder="ex: 12:45 ou 150 reps"
                    className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" 
                    disabled={isSaving}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Categoria</label>
                  <div className="flex gap-2">
                    {['RX', 'SCALED', 'BEGINNER'].map((t) => (
                      <button
                        key={t}
                        onClick={() => setNewResult({...newResult, type: t})}
                        disabled={isSaving}
                        className={cn(
                          "flex-1 py-3 rounded-xl font-headline font-bold text-[10px] uppercase tracking-widest transition-all disabled:opacity-50",
                          newResult.type === t ? "bg-primary text-background shadow-lg" : "bg-surface-container-highest text-on-surface-variant"
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <button 
                  onClick={handleRegisterResult}
                  disabled={isSaving}
                  className="w-full bg-primary text-background py-4 rounded-2xl font-headline font-black uppercase italic shadow-lg mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'SALVANDO...' : isEditing ? 'ATUALIZAR RESULTADO' : 'SALVAR RESULTADO'}
                </button>
                {isEditing && (
                  <button 
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                    className="w-full bg-surface-container-highest text-on-surface py-3 rounded-2xl font-headline font-bold uppercase italic shadow-sm disabled:opacity-50"
                  >
                    CANCELAR
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
        }
