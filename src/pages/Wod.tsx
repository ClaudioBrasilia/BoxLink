import { useState, useEffect } from 'react';
import { Calendar, Timer, Activity, Trophy, ChevronLeft, ChevronRight, Info, X, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { Wod as WodType } from '../types';
import { format, addDays, subDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

import { supabase } from '../lib/supabase';

export default function Wod() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [wods, setWods] = useState<WodType[]>([]);
  const [currentWod, setCurrentWod] = useState<WodType | null>(null);
  const [results, setResults] = useState<any[]>([]);
  const [isRegistering, setIsRegistering] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [newResult, setNewResult] = useState({ result: '', type: 'RX' });

  const fetchResults = async (wodId: string) => {
    const { data } = await supabase
      .from('wod_results')
      .select('*, profiles(name)')
      .eq('wod_id', wodId)
      .order('created_at', { ascending: false });
    setResults(data || []);
  };

  useEffect(() => {
    const fetchWods = async () => {
      const { data } = await supabase.from('wods').select('*');
      setWods(data || []);
      
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const found = (data || []).find((w: any) => w.date === dateStr);
      setCurrentWod(found || null);
      if (found) {
        fetchResults(found.id);
      } else {
        setResults([]);
      }
    };
    fetchWods();
  }, [selectedDate]);

  const handleRegisterResult = async () => {
    if (!user || !currentWod || !newResult.result) return;
    
    const { error } = await supabase
      .from('wod_results')
      .insert({
        user_id: user.id,
        wod_id: currentWod.id,
        result: newResult.result,
        type: newResult.type
      });

    if (!error) {
      setIsRegistering(false);
      setShowSuccess(true);
      setNewResult({ result: '', type: 'RX' });
      fetchResults(currentWod.id);
    } else {
      console.error('Error registering result:', error);
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

              {/* Leaderboard for this WOD */}
              <div className="space-y-4">
                <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-secondary" /> RESULTADOS DO DIA
                </h3>
                
                <div className="space-y-3">
                  {results.length > 0 ? results.map((res, i) => (
                    <div key={res.id} className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/10 flex items-center justify-between group hover:border-primary/30 transition-all">
                      <div className="flex items-center gap-4">
                        <span className="w-6 text-on-surface-variant font-headline font-black text-xs italic">#{i + 1}</span>
                        <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface font-headline font-black text-sm">
                          {res.profiles?.name?.[0] || 'A'}
                        </div>
                        <div>
                          <p className="text-on-surface font-bold uppercase text-sm italic">{res.profiles?.name || 'Atleta'}</p>
                          <span className={cn(
                            "text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border",
                            res.type === 'RX' ? "bg-primary/20 text-primary border-primary/30" : "bg-secondary/20 text-secondary border-secondary/30"
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
              <button 
                onClick={() => setIsRegistering(true)}
                className="w-full bg-primary text-background py-5 rounded-2xl font-headline font-black text-lg shadow-lg uppercase italic tracking-tight flex items-center justify-center gap-2 mt-4"
              >
                REGISTRAR RESULTADO <ChevronRight className="w-5 h-5" />
              </button>
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
        {isRegistering && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-md bg-surface-container-low rounded-[2.5rem] border border-outline-variant/10 p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-headline font-bold text-xl text-on-surface uppercase italic">REGISTRAR RESULTADO</h3>
                <button onClick={() => setIsRegistering(false)} className="p-2 hover:bg-surface-container-highest rounded-xl transition-all">
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
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Categoria</label>
                  <div className="flex gap-2">
                    {['RX', 'SCALED', 'BEGINNER'].map((t) => (
                      <button
                        key={t}
                        onClick={() => setNewResult({...newResult, type: t})}
                        className={cn(
                          "flex-1 py-3 rounded-xl font-headline font-bold text-[10px] uppercase tracking-widest transition-all",
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
                  className="w-full bg-primary text-background py-4 rounded-2xl font-headline font-black uppercase italic shadow-lg mt-4"
                >
                  SALVAR RESULTADO
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Success Notification */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 left-4 right-4 z-50 bg-primary text-background p-4 rounded-2xl shadow-2xl flex items-center justify-center gap-3 font-headline font-black italic"
          >
            <Check className="w-6 h-6" /> RESULTADO SALVO COM SUCESSO!
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
