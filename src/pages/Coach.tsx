import { useState, useEffect } from 'react';
import { LayoutDashboard, Users, Calendar, Megaphone, Plus, Settings, ChevronRight, Activity, Timer, Trophy, Check, X, Shield, UserPlus, Info, Edit2, Save } from 'lucide-react';
import { cn } from '../lib/utils';
import { Wod, User } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';

import { formatInTimeZone } from 'date-fns-tz';

const TIMEZONE = "America/Sao_Paulo";

export default function Coach() {
  const [wods, setWods] = useState<Wod[]>([]);
  const [athletes, setAthletes] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'aula' | 'history' | 'results'>('aula');
  const [selectedHistoryDate, setSelectedHistoryDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedResultsDate, setSelectedResultsDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [editingWod, setEditingWod] = useState<Partial<Wod> | null>(null);
  const [newWod, setNewWod] = useState<Partial<Wod>>({
    date: format(new Date(), 'yyyy-MM-dd'),
    name: '',
    type: 'AMRAP',
    warmup: '',
    skill: '',
    rx: '',
    scaled: '',
    beginner: '',
  });

  const fetchData = async () => {
    const today = formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM-dd");

    // Fetch WODs
    const { data: wodsData } = await supabase.from('wods').select('*').order('date', { ascending: false });
    setWods(wodsData || []);

    // Fetch Athletes (Check-ins for today)
    const { data: athletesData } = await supabase
      .from('checkins')
      .select('*, profiles(*)')
      .eq('date', today);
    setAthletes(athletesData || []);

    // Fetch Results for today's WODs
    const { data: todayWods } = await supabase.from('wods').select('id').eq('date', today);
    if (todayWods && todayWods.length > 0) {
      const { data: resultsData } = await supabase
        .from('wod_results')
        .select('*, profiles(name), wods(*)')
        .in('wod_id', todayWods.map(w => w.id))
        .order('created_at', { ascending: false });
      setResults(resultsData || []);
    } else {
      setResults([]);
    }
  };

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('coach_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wods' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checkins' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wod_results' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleSaveWod = async () => {
    if (!newWod.name || !newWod.date) return;
    
    const { data, error } = await supabase
      .from('wods')
      .insert({
        date: newWod.date,
        name: newWod.name,
        type: newWod.type,
        warmup: newWod.warmup,
        skill: newWod.skill,
        rx: newWod.rx,
        scaled: newWod.scaled,
        beginner: newWod.beginner
      })
      .select()
      .single();
    
    if (!error && data) {
      setWods([data, ...wods]);
      alert('WOD Postado com Sucesso!');
      setNewWod({
        date: format(new Date(), 'yyyy-MM-dd'),
        name: '',
        type: 'AMRAP',
        warmup: '',
        skill: '',
        rx: '',
        scaled: '',
        beginner: '',
      });
    } else {
      console.error('Error saving WOD:', error);
      alert('Erro ao postar WOD: ' + error?.message);
    }
  };

  // Helper to parse time string "MM:SS" to seconds
  const timeToSeconds = (timeStr: string) => {
    const [min, sec] = timeStr.split(':').map(Number);
    return (min * 60) + (sec || 0);
  };

  // Improved Ranking Logic
  const getRankedResults = () => {
    const filteredResults = results.filter(r => 
      format(new Date(r.created_at), 'yyyy-MM-dd') === selectedResultsDate
    );

    const categories = ['RX', 'Scaled', 'Beginner'];
    const ranked: Record<string, any[]> = {};

    categories.forEach(cat => {
      const catResults = filteredResults.filter(r => r.type === cat);
      
      ranked[cat] = catResults.sort((a, b) => {
        const isForTime = a.wods?.type === 'FOR TIME';
        
        if (isForTime) {
          return timeToSeconds(a.result) - timeToSeconds(b.result);
        } else {
          // AMRAP/Reps: Higher is better
          return parseFloat(b.result) - parseFloat(a.result);
        }
      });
    });

    return ranked;
  };

  const rankedData = getRankedResults();
  const handleUpdateWod = async () => {
    if (!editingWod?.id || !editingWod.name) return;
    const { error } = await supabase
      .from('wods')
      .update({
        name: editingWod.name,
        type: editingWod.type,
        warmup: editingWod.warmup,
        skill: editingWod.skill,
        rx: editingWod.rx,
        scaled: editingWod.scaled,
        beginner: editingWod.beginner,
      })
      .eq('id', editingWod.id);
    if (!error) {
      setWods(wods.map(w => w.id === editingWod.id ? { ...w, ...editingWod } as Wod : w));
      setEditingWod(null);
      alert('WOD atualizado com sucesso!');
    } else {
      alert('Erro ao atualizar: ' + error.message);
    }
  };

  const historyWod = (wods || []).find(w => w && w.date === selectedHistoryDate);

  return (
    <div className="flex flex-col gap-6 p-4 pt-8 min-h-screen bg-background">
      <header className="flex justify-between items-center">
        <h1 className="text-3xl font-headline font-black text-on-surface tracking-tight uppercase italic flex items-center gap-3">
          <LayoutDashboard className="w-8 h-8 text-primary" />
          PAINEL COACH
        </h1>
      </header>

      {/* Tabs */}
      <div className="flex bg-surface-container-low p-1 rounded-2xl border border-outline-variant/10 overflow-x-auto no-scrollbar">
        {(['aula', 'history', 'results'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 min-w-[100px] py-3 rounded-xl font-headline font-bold text-[10px] uppercase tracking-widest transition-all",
              activeTab === tab ? "bg-primary text-background shadow-lg" : "text-on-surface-variant hover:text-on-surface"
            )}
          >
            {tab === 'aula' ? 'AULA DE HOJE' : tab === 'history' ? 'HISTÓRICO' : 'RANKING'}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'aula' && (
          <motion.div
            key="aula"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="flex flex-col gap-8"
          >
            {/* Post WOD Section */}
            <div className="bg-surface-container-low p-6 rounded-[2.5rem] border border-outline-variant/10 space-y-6">
              <div className="flex items-center gap-2 mb-2">
                <Plus className="w-5 h-5 text-primary" />
                <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic">POSTAR TREINO</h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Data</label>
                  <input type="date" value={newWod.date} onChange={e => setNewWod({...newWod, date: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Tipo</label>
                  <select value={newWod.type} onChange={e => setNewWod({...newWod, type: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface">
                    <option>AMRAP</option>
                    <option>EMOM</option>
                    <option>FOR TIME</option>
                    <option>TABATA</option>
                    <option>HERO WOD</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Nome do WOD</label>
                <input type="text" value={newWod.name} onChange={e => setNewWod({...newWod, name: e.target.value})} placeholder="ex: MURPH" className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">WARM UP</label>
                <textarea rows={3} value={newWod.warmup} onChange={e => setNewWod({...newWod, warmup: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface resize-none" />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">SKILL</label>
                <textarea rows={3} value={newWod.skill} onChange={e => setNewWod({...newWod, skill: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface resize-none" />
              </div>

              <div className="space-y-4 pt-4 border-t border-outline-variant/10">
                <div className="space-y-2">
                  <label className="text-[10px] text-primary font-bold uppercase tracking-widest">RX</label>
                  <textarea rows={2} value={newWod.rx} onChange={e => setNewWod({...newWod, rx: e.target.value})} className="w-full bg-primary/5 border border-primary/20 rounded-2xl p-4 font-headline font-bold text-on-surface resize-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-secondary font-bold uppercase tracking-widest">SCALED</label>
                  <textarea rows={2} value={newWod.scaled} onChange={e => setNewWod({...newWod, scaled: e.target.value})} className="w-full bg-secondary/5 border border-secondary/20 rounded-2xl p-4 font-headline font-bold text-on-surface resize-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">BEGINNER</label>
                  <textarea rows={2} value={newWod.beginner} onChange={e => setNewWod({...newWod, beginner: e.target.value})} className="w-full bg-surface-container-highest border border-outline-variant/10 rounded-2xl p-4 font-headline font-bold text-on-surface resize-none" />
                </div>
              </div>

              <button onClick={handleSaveWod} className="w-full bg-primary text-background py-5 rounded-2xl font-headline font-black text-lg uppercase italic shadow-lg flex items-center justify-center gap-3 hover:scale-[0.98] transition-all">
                <Plus className="w-6 h-6" /> POSTAR WOD
              </button>
            </div>

            {/* Today's Athletes Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic">CHECK-INS DE HOJE</h3>
              </div>
              <div className="grid gap-3">
                {athletes.length > 0 ? athletes.map((athlete) => (
                  <div key={athlete.id} className="bg-surface-container-low p-4 rounded-3xl border border-outline-variant/10 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-surface-container-highest border border-outline-variant/10 overflow-hidden">
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${athlete.profiles?.name}`} alt="Avatar" className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <p className="text-on-surface font-bold uppercase text-sm italic">{athlete.profiles?.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="bg-primary/20 text-primary text-[8px] font-black px-2 py-0.5 rounded-full uppercase">Atleta</span>
                          <span className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">{athlete.time}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Check className="w-4 h-4 text-primary" />
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="bg-surface-container-low p-8 rounded-3xl border border-outline-variant/10 text-center">
                    <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest opacity-50 italic">Nenhum check-in hoje</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'history' && (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="flex flex-col gap-6"
          >
            <div className="bg-surface-container-low p-6 rounded-[2.5rem] border border-outline-variant/10">
              <div className="flex items-center gap-2 mb-6">
                <Calendar className="w-5 h-5 text-primary" />
                <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic">CALENDÁRIO DE TREINOS</h3>
              </div>
              
              <input 
                type="date" 
                value={selectedHistoryDate} 
                onChange={e => setSelectedHistoryDate(e.target.value)}
                className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface mb-6"
              />

              {historyWod ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                  <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-[10px] text-primary font-black uppercase tracking-widest mb-1">WOD DO DIA</p>
                        <h4 className="text-xl font-headline font-black text-on-surface uppercase italic">{historyWod.name}</h4>
                        <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest mt-1">{historyWod.type}</p>
                      </div>
                      <button onClick={() => setEditingWod({...historyWod})}
                        className="bg-primary/20 text-primary p-2 rounded-xl hover:bg-primary hover:text-background transition-all flex items-center gap-1">
                        <Edit2 className="w-4 h-4" />
                        <span className="text-[9px] font-black uppercase">EDITAR</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <div className="p-4 bg-surface-container-highest rounded-2xl">
                      <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest mb-2">WARM UP</p>
                      <p className="text-sm text-on-surface font-medium whitespace-pre-wrap">{historyWod.warmup}</p>
                    </div>
                    <div className="p-4 bg-surface-container-highest rounded-2xl">
                      <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest mb-2">SKILL</p>
                      <p className="text-sm text-on-surface font-medium whitespace-pre-wrap">{historyWod.skill}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
                        <p className="text-[10px] text-primary font-black uppercase tracking-widest mb-2">RX</p>
                        <p className="text-xs text-on-surface font-bold whitespace-pre-wrap">{historyWod.rx}</p>
                      </div>
                      <div className="p-4 bg-secondary/5 rounded-2xl border border-secondary/10">
                        <p className="text-[10px] text-secondary font-black uppercase tracking-widest mb-2">SCALED</p>
                        <p className="text-xs text-on-surface font-bold whitespace-pre-wrap">{historyWod.scaled}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 opacity-50">
                  <Activity className="w-12 h-12 text-on-surface-variant mx-auto mb-4 opacity-20" />
                  <p className="text-on-surface-variant text-sm font-bold uppercase tracking-widest italic">Nenhum WOD registrado nesta data</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'results' && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="flex flex-col gap-6"
          >
            <div className="bg-surface-container-low p-6 rounded-[2.5rem] border border-outline-variant/10">
              <div className="flex items-center gap-2 mb-6">
                <Trophy className="w-5 h-5 text-primary" />
                <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic">RANKING POR DATA</h3>
              </div>
              
              <input 
                type="date" 
                value={selectedResultsDate} 
                onChange={e => setSelectedResultsDate(e.target.value)}
                className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface mb-2"
              />
            </div>

            <div className="flex justify-between items-center mb-2">
              <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic">RESULTADOS</h3>
              <span className="bg-secondary/20 text-secondary text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
                {Object.values(rankedData).flat().length} REGISTROS
              </span>
            </div>

            {Object.entries(rankedData).map(([category, catResults]) => (
              <div key={category} className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-1 h-6 rounded-full",
                    category === 'RX' ? "bg-primary" : category === 'Scaled' ? "bg-secondary" : "bg-on-surface-variant"
                  )} />
                  <h4 className="font-headline font-black text-on-surface uppercase italic tracking-tight">{category}</h4>
                </div>

                <div className="space-y-3">
                  {catResults.length > 0 ? catResults.map((res, index) => (
                    <div key={res.id} className="bg-surface-container-low p-4 rounded-3xl border border-outline-variant/10 flex items-center justify-between group hover:border-primary/30 transition-all">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center font-headline font-black text-lg",
                          index === 0 ? "bg-primary text-background" : "bg-surface-container-highest text-on-surface"
                        )}>
                          {index + 1}
                        </div>
                        <div>
                          <p className="text-on-surface font-bold uppercase text-sm italic">{res.profiles?.name}</p>
                          <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">{res.wods?.name || 'WOD'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="bg-surface-container-highest px-4 py-2 rounded-2xl border border-outline-variant/10">
                          <span className="text-primary font-headline font-black text-lg italic">{res.result}</span>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="bg-surface-container-low/50 p-6 rounded-3xl border border-dashed border-outline-variant/20 text-center">
                      <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest opacity-40 italic">Sem resultados nesta categoria</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Editar WOD */}
      <AnimatePresence>
        {editingWod && (
          <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 100 }}
              className="w-full max-w-lg bg-surface-container-low rounded-[2.5rem] border border-outline-variant/10 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-5">
                <h3 className="font-headline font-bold text-xl text-on-surface uppercase italic flex items-center gap-2">
                  <Edit2 className="w-5 h-5 text-primary" /> EDITAR WOD
                </h3>
                <button onClick={() => setEditingWod(null)} className="p-2 hover:bg-surface-container-highest rounded-xl">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Nome</label>
                    <input type="text" value={editingWod.name || ''} onChange={e => setEditingWod({...editingWod, name: e.target.value})}
                      className="w-full bg-surface-container-highest border-none rounded-2xl p-3 font-headline font-bold text-on-surface text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Tipo</label>
                    <select value={editingWod.type || 'AMRAP'} onChange={e => setEditingWod({...editingWod, type: e.target.value})}
                      className="w-full bg-surface-container-highest border-none rounded-2xl p-3 font-headline font-bold text-on-surface text-sm">
                      <option value="AMRAP">AMRAP</option>
                      <option value="FOR TIME">FOR TIME</option>
                      <option value="EMOM">EMOM</option>
                      <option value="TABATA">TABATA</option>
                      <option value="STRENGTH">STRENGTH</option>
                      <option value="BENCHMARK">BENCHMARK</option>
                    </select>
                  </div>
                </div>
                {[{key:'warmup',label:'Aquecimento'},{key:'skill',label:'Skill'},{key:'rx',label:'RX'},{key:'scaled',label:'Scaled'},{key:'beginner',label:'Iniciante'}].map(({key,label}) => (
                  <div key={key} className="space-y-1">
                    <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">{label}</label>
                    <textarea value={(editingWod as any)[key] || ''} onChange={e => setEditingWod({...editingWod, [key]: e.target.value})}
                      rows={3} className="w-full bg-surface-container-highest border-none rounded-2xl p-3 font-headline font-bold text-on-surface text-sm resize-none" />
                  </div>
                ))}
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setEditingWod(null)}
                    className="flex-1 bg-surface-container-highest text-on-surface py-3 rounded-2xl font-headline font-black text-xs uppercase italic">CANCELAR</button>
                  <button onClick={handleUpdateWod}
                    className="flex-1 bg-primary text-background py-3 rounded-2xl font-headline font-black text-xs uppercase italic flex items-center justify-center gap-2">
                    <Save className="w-4 h-4" /> SALVAR
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
