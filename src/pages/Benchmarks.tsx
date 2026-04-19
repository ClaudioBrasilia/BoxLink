import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { BarChart3, Trophy, TrendingUp, Plus, X, Save, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Benchmark {
  id: string;
  user_id: string;
  exercise: string;
  value: string;
  unit: string;
  created_at: string;
  profiles?: { name: string; level: number };
}

const COMMON_EXERCISES = [
  'Fran', 'Grace', 'Helen', 'Murph', 'Cindy', 'Annie', 'Barbara',
  'Clean 1RM', 'Snatch 1RM', 'Back Squat 1RM', 'Deadlift 1RM',
  'Strict Press 1RM', 'Push Press 1RM', 'Thruster 1RM',
  'Pull-ups Máx', 'HSPU Máx', 'Double Unders 1min',
  'Row 500m', 'Run 400m', 'Row 2000m',
];

export default function Benchmarks() {
  const { user } = useAuth();
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([]);
  const [allBenchmarks, setAllBenchmarks] = useState<Benchmark[]>([]);
  const [activeTab, setActiveTab] = useState<'meus' | 'ranking'>('meus');
  const [showForm, setShowForm] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState('');
  const [exerciseInput, setExerciseInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('kg');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rankingExercise, setRankingExercise] = useState('');
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null);

  const filteredSuggestions = COMMON_EXERCISES.filter(e =>
    e.toLowerCase().includes(exerciseInput.toLowerCase()) && exerciseInput.length > 0
  );

  useEffect(() => { if (user) fetchData(); }, [user]);

  const fetchData = async () => {
    setLoading(true);
    const [myRes, allRes] = await Promise.all([
      supabase.from('benchmarks').select('*').eq('user_id', user!.id).order('created_at', { ascending: false }),
      supabase.from('benchmarks').select('*, profiles(name, level)').order('created_at', { ascending: false }),
    ]);
    setBenchmarks(myRes.data || []);
    setAllBenchmarks(allRes.data || []);
    if ((allRes.data || []).length > 0) {
      setRankingExercise(allRes.data![0].exercise);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    const exerciseName = exerciseInput.trim();
    if (!exerciseName || !value.trim() || !user) return;
    setSaving(true);
    const { error } = await supabase.from('benchmarks').insert({
      user_id: user.id,
      exercise: exerciseName,
      value: value.trim(),
      unit,
    });
    if (!error) {
      setShowForm(false);
      setExerciseInput('');
      setValue('');
      setUnit('kg');
      fetchData();
    } else {
      alert('Erro ao salvar: ' + error.message);
    }
    setSaving(false);
  };

  // Group my benchmarks by exercise (latest per exercise)
  const myPRs: Record<string, Benchmark> = {};
  benchmarks.forEach(b => {
    if (!myPRs[b.exercise]) myPRs[b.exercise] = b;
  });

  // History for a specific exercise
  const historyFor = (exercise: string) =>
    benchmarks.filter(b => b.exercise === exercise)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map(b => ({ date: new Date(b.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), value: b.value, raw: b }));

  // All exercises in ranking
  const rankingExercises = [...new Set(allBenchmarks.map(b => b.exercise))].sort();

  // Ranking for selected exercise
  const rankingData = allBenchmarks
    .filter(b => b.exercise === rankingExercise)
    .reduce((acc: Record<string, Benchmark>, b) => {
      if (!acc[b.user_id]) acc[b.user_id] = b;
      return acc;
    }, {});
  const rankingSorted = Object.values(rankingData)
    .sort((a, b) => {
      const numA = parseFloat(a.value.replace(/[^0-9.]/g, '')) || 0;
      const numB = parseFloat(b.value.replace(/[^0-9.]/g, '')) || 0;
      const isTime = a.unit === 'min' || a.unit === 'seg';
      return isTime ? numA - numB : numB - numA;
    });

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center text-primary font-headline font-black text-2xl italic animate-pulse">
      CARREGANDO...
    </div>
  );

  return (
    <div className="flex flex-col gap-6 p-4 pt-8 min-h-screen bg-background">
      <header className="flex justify-between items-center">
        <h1 className="text-3xl font-headline font-black text-on-surface tracking-tight uppercase italic flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-primary" /> BENCHMARKS
        </h1>
        <button onClick={() => setShowForm(true)}
          className="bg-primary text-background px-4 py-2 rounded-xl font-headline font-black text-xs uppercase italic flex items-center gap-2 shadow-lg">
          <Plus className="w-4 h-4" /> NOVO PR
        </button>
      </header>

      {/* Tabs */}
      <div className="flex bg-surface-container-low p-1 rounded-2xl border border-outline-variant/10 gap-1">
        {([
          { key: 'meus', label: 'MEUS PRs' },
          { key: 'ranking', label: 'RANKING' },
        ] as const).map(({ key, label }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={cn("flex-1 py-3 rounded-xl font-headline font-bold text-[10px] uppercase tracking-widest transition-all",
              activeTab === key ? "bg-primary text-background shadow-lg" : "text-on-surface-variant hover:text-on-surface"
            )}>{label}</button>
        ))}
      </div>

      {/* MEUS PRs */}
      {activeTab === 'meus' && (
        <div className="flex flex-col gap-4">
          {Object.keys(myPRs).length === 0 ? (
            <div className="bg-surface-container-low rounded-3xl border border-outline-variant/10 p-10 text-center flex flex-col items-center gap-4">
              <Trophy className="w-12 h-12 text-outline-variant opacity-30" />
              <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest italic">
                Nenhum PR registrado ainda
              </p>
              <button onClick={() => setShowForm(true)}
                className="bg-primary text-background px-6 py-3 rounded-xl font-headline font-black text-sm uppercase italic">
                REGISTRAR PRIMEIRO PR
              </button>
            </div>
          ) : (
            Object.values(myPRs).map(pr => {
              const history = historyFor(pr.exercise);
              const isExpanded = expandedExercise === pr.exercise;
              return (
                <motion.div key={pr.exercise} layout
                  className="bg-surface-container-low rounded-3xl border border-outline-variant/10 overflow-hidden">
                  <button
                    onClick={() => setExpandedExercise(isExpanded ? null : pr.exercise)}
                    className="w-full flex items-center justify-between p-5"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-primary/20 rounded-2xl flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-primary" />
                      </div>
                      <div className="text-left">
                        <p className="text-on-surface font-headline font-black text-sm uppercase italic">{pr.exercise}</p>
                        <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">
                          {history.length} registro{history.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-primary font-headline font-black text-lg italic">{pr.value} <span className="text-xs">{pr.unit}</span></p>
                        <p className="text-on-surface-variant text-[9px] font-bold uppercase">PR ATUAL</p>
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-on-surface-variant" /> : <ChevronDown className="w-4 h-4 text-on-surface-variant" />}
                    </div>
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t border-outline-variant/10 px-5 pb-5">
                        {history.length > 1 ? (
                          <div className="mt-4">
                            <p className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest mb-3">EVOLUÇÃO</p>
                            <div className="h-32">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={history}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                  <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
                                  <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
                                  <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: 12 }} />
                                  <Line type="monotone" dataKey="value" stroke="#CAFD00" strokeWidth={2} dot={{ r: 4, fill: '#CAFD00' }} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        ) : (
                          <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest mt-4 text-center italic">
                            Registre mais PRs para ver a evolução
                          </p>
                        )}
                        <div className="flex flex-col gap-2 mt-3">
                          {history.slice().reverse().map((h, i) => (
                            <div key={i} className="flex justify-between items-center bg-surface-container-highest/30 rounded-xl px-3 py-2">
                              <span className="text-[10px] text-on-surface-variant font-bold">{h.date}</span>
                              <span className="text-sm font-headline font-black text-on-surface italic">{h.value} {h.raw.unit}</span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })
          )}
        </div>
      )}

      {/* RANKING */}
      {activeTab === 'ranking' && (
        <div className="flex flex-col gap-4">
          {/* Exercise selector */}
          <div className="bg-surface-container-low rounded-2xl border border-outline-variant/10 p-4">
            <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest mb-2 block">Selecione o exercício</label>
            {rankingExercises.length === 0 ? (
              <p className="text-on-surface-variant text-xs font-bold italic">Nenhum benchmark registrado ainda</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {rankingExercises.map(ex => (
                  <button key={ex} onClick={() => setRankingExercise(ex)}
                    className={cn("px-3 py-1.5 rounded-xl font-headline font-black text-[10px] uppercase italic transition-all border",
                      rankingExercise === ex ? "bg-primary text-background border-primary" : "bg-surface-container-highest text-on-surface-variant border-outline-variant/20 hover:border-primary/40"
                    )}>{ex}</button>
                ))}
              </div>
            )}
          </div>

          {/* Ranking list */}
          {rankingSorted.length === 0 ? (
            <p className="text-center text-on-surface-variant text-xs font-bold uppercase tracking-widest py-6 italic">
              Nenhum resultado para este exercício
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {rankingSorted.map((r, i) => (
                <motion.div key={r.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                  className={cn("p-4 rounded-2xl border flex items-center justify-between",
                    r.user_id === user?.id ? "bg-primary/10 border-primary/30" : "bg-surface-container-low border-outline-variant/10"
                  )}>
                  <div className="flex items-center gap-3">
                    <span className={cn("w-8 h-8 rounded-full flex items-center justify-center font-headline font-black text-sm",
                      i === 0 ? "bg-primary text-background" : i === 1 ? "bg-outline-variant/40 text-on-surface" : i === 2 ? "bg-secondary/30 text-on-surface" : "bg-surface-container-highest text-on-surface-variant"
                    )}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                    </span>
                    <div>
                      <p className="text-on-surface font-bold uppercase text-sm italic">
                        {r.profiles?.name || 'Atleta'}
                        {r.user_id === user?.id && <span className="text-primary text-[9px] ml-1">(você)</span>}
                      </p>
                      <p className="text-on-surface-variant text-[10px] font-bold">Nível {r.profiles?.level || 1}</p>
                    </div>
                  </div>
                  <p className="text-primary font-headline font-black text-lg italic">{r.value} <span className="text-xs">{r.unit}</span></p>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal Novo PR */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 100 }}
              className="w-full max-w-md bg-surface-container-low rounded-[2.5rem] border border-outline-variant/10 p-6 shadow-2xl">
              <div className="flex justify-between items-center mb-5">
                <h3 className="font-headline font-bold text-xl text-on-surface uppercase italic">REGISTRAR PR</h3>
                <button onClick={() => setShowForm(false)} className="p-2 hover:bg-surface-container-highest rounded-xl">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Exercise input with suggestions */}
                <div className="space-y-2 relative">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Exercício</label>
                  <input
                    type="text"
                    value={exerciseInput}
                    onChange={e => { setExerciseInput(e.target.value); setShowSuggestions(true); }}
                    onFocus={() => setShowSuggestions(true)}
                    placeholder="Ex: Fran, Clean 1RM, Row 500m..."
                    className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface outline-none text-sm"
                  />
                  {/* Suggestions */}
                  <AnimatePresence>
                    {showSuggestions && filteredSuggestions.length > 0 && (
                      <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                        className="absolute top-full left-0 right-0 z-10 bg-surface-container-highest rounded-2xl border border-outline-variant/20 shadow-xl overflow-hidden mt-1">
                        {filteredSuggestions.slice(0, 5).map(s => (
                          <button key={s} onClick={() => { setExerciseInput(s); setShowSuggestions(false); }}
                            className="w-full text-left px-4 py-3 text-sm font-bold text-on-surface hover:bg-primary/10 hover:text-primary transition-all uppercase italic border-b border-outline-variant/10 last:border-0">
                            {s}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {/* Suggestions chips */}
                  {exerciseInput.length === 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {COMMON_EXERCISES.slice(0, 6).map(s => (
                        <button key={s} onClick={() => setExerciseInput(s)}
                          className="px-2 py-1 bg-surface-container-highest text-on-surface-variant text-[9px] font-black uppercase italic rounded-lg hover:bg-primary/20 hover:text-primary transition-all">
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Value + Unit */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Resultado</label>
                    <input type="text" value={value} onChange={e => setValue(e.target.value)}
                      placeholder="Ex: 95, 3:45, 15"
                      className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface outline-none text-sm" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Unidade</label>
                    <select value={unit} onChange={e => setUnit(e.target.value)}
                      className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface text-sm">
                      <option value="kg">kg</option>
                      <option value="lb">lb</option>
                      <option value="min">min</option>
                      <option value="seg">seg</option>
                      <option value="reps">reps</option>
                      <option value="m">m</option>
                      <option value="cal">cal</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={() => setShowForm(false)}
                    className="flex-1 bg-surface-container-highest text-on-surface py-3 rounded-2xl font-headline font-black text-xs uppercase italic">
                    CANCELAR
                  </button>
                  <button onClick={handleSave} disabled={saving || !exerciseInput.trim() || !value.trim()}
                    className="flex-1 bg-primary text-background py-3 rounded-2xl font-headline font-black text-xs uppercase italic flex items-center justify-center gap-2 disabled:opacity-50">
                    <Save className="w-4 h-4" /> {saving ? 'SALVANDO...' : 'SALVAR PR'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
