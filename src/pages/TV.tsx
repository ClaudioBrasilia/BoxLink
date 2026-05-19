import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Timer, Trophy, Zap, Swords, Maximize, LayoutDashboard, Activity, Users, Play, Pause, RotateCcw, ChevronLeft, ChevronRight, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wod, User } from '../types';
import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import AvatarPreview from '../components/AvatarPreview';

const TIMEZONE = "America/Sao_Paulo";

export default function TV() {
  const [data, setData] = useState<any>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [timer, setTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isWodAutoRotationActive, setIsWodAutoRotationActive] = useState(true);
  const [rankingView, setRankingView] = useState<'xp' | 'frequency'>('xp');
  const [athleteIndex, setAthleteIndex] = useState(0);
  const [wodTabIndex, setWodTabIndex] = useState(0);
  const [liveWorkoutMode, setLiveWorkoutMode] = useState(false); // ← Novo estado
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Relógio em tempo real
  useEffect(() => {
    const clockInterval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clockInterval);
  }, []);

  // ... (todo o fetchData permanece igual - não alterei para manter compatibilidade)

  const fetchData = useCallback(async () => {
    // ← Mantenha exatamente o mesmo fetchData que você já tem (colei completo se quiser, mas para não ficar gigante, assuma que é o mesmo)
    // Se quiser, posso mandar só as mudanças, mas por enquanto mantenha o seu atual.
    try {
      // ... seu código atual de fetchData (inteiro) ...
      // No final do setData, adicione:
      setData({
        ...seuObjetoAtual,
        // nada novo por enquanto
      });
    } catch (err: any) {
      console.error('TV Fetch Error:', err);
      setError(err.message);
    }
  }, []);

  // ... mantenha todos os useEffects que você já tem (clock, fetch, athlete rotation, ranking, timer, etc.)

  // Função auxiliar para simular BPM (vamos substituir depois por dados reais)
  const getMockBPM = (userId: string) => {
    return Math.floor(Math.random() * 40) + 130; // 130 ~ 170
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans overflow-hidden flex flex-col p-6 gap-6 relative select-none">
      {/* Header - mantido igual */}
      <header className="flex justify-between items-center bg-[#111] rounded-[2rem] p-6 border border-white/5 shadow-2xl">
        {/* ... seu header atual completo ... */}
        {/* Adicionei um botão para alternar modo Live */}
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setLiveWorkoutMode(!liveWorkoutMode)}
            className={cn("flex items-center gap-2 px-5 py-2.5 rounded-2xl font-black text-sm uppercase tracking-widest transition-all",
              liveWorkoutMode 
                ? "bg-red-500/90 text-white" 
                : "bg-primary text-black hover:bg-primary/90"
            )}>
            <Heart className="w-5 h-5" />
            {liveWorkoutMode ? "SAIR DO MODO AO VIVO" : "MODO TREINO AO VIVO"}
          </button>
          {/* ... resto do header (fullscreen, timer, etc.) */}
        </div>
      </header>

      <div className="flex-1 grid grid-cols-12 gap-6 overflow-hidden">
        {/* Coluna esquerda - WOD */}
        <div className="col-span-7 flex flex-col gap-6">
          {/* Tabs do WOD (mantido igual) */}
          <div className="flex items-center justify-between bg-[#111] rounded-3xl p-3 border border-white/5">
            {/* ... seus botões WARM-UP, SKILL, THE WOD ... */}
          </div>

          <div className="flex-1 relative">
            <AnimatePresence mode="wait">
              {/* Seu código atual de Warm-up, Skill e WOD permanece igual */}
              {/* ... cole aqui as 3 seções motion.section que você já tem ... */}
            </AnimatePresence>
          </div>
        </div>

        {/* Coluna direita - Ranking + Atletas com BPM */}
        <div className="col-span-5 flex flex-col gap-6">
          {/* Ranking - sempre visível */}
          <section className="bg-[#111] rounded-[2.5rem] p-5 border border-white/5 flex flex-col" style={{ flex: liveWorkoutMode ? '1.2 1 0' : '2 1 0' }}>
            {/* ... seu código atual do TOP 3 + ranking ... (mantido igual) */}
          </section>

          {/* === NOVA SEÇÃO: ALUNOS AO VIVO COM FREQUÊNCIA CARDÍACA === */}
          {liveWorkoutMode && (
            <section className="bg-[#111] rounded-[2.5rem] p-6 border border-white/5 flex-1 overflow-hidden flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-2xl bg-red-500/10 flex items-center justify-center">
                    <Heart className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-headline font-black uppercase italic tracking-tight">FREQUÊNCIA CARDÍACA</h3>
                    <p className="text-red-500 text-sm font-black tracking-widest">AO VIVO • TREINO ATUAL</p>
                  </div>
                </div>
                <span className="bg-red-500/10 text-red-500 px-4 py-1 rounded-2xl text-sm font-black">
                  {data?.checkins?.length || 0} ATLETAS
                </span>
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar space-y-3 pr-2">
                {data?.checkins?.length > 0 ? (
                  data.checkins.map((c: any, index: number) => {
                    const profile = c?.profiles;
                    const bpm = getMockBPM(profile?.id || index); // ← depois vamos pegar do Supabase
                    const zoneColor = bpm > 160 ? 'text-red-500' : bpm > 140 ? 'text-orange-500' : 'text-emerald-500';

                    return (
                      <motion.div
                        key={c.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center justify-between bg-white/5 hover:bg-white/10 rounded-2xl p-4 transition-all border border-white/10"
                      >
                        <div className="flex items-center gap-4">
                          <AvatarPreview 
                            equipped={profile?.avatar_equipped} 
                            size="md"
                            className="border-2 border-white/20" 
                          />
                          <div>
                            <p className="font-headline font-black text-lg uppercase tracking-tight">
                              {profile?.name?.split(' ')[0] || 'Atleta'}
                            </p>
                            <p className="text-white/40 text-xs">Check-in confirmado</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 text-right">
                          <div className={`text-5xl font-headline font-black tabular-nums ${zoneColor}`}>
                            {bpm}
                          </div>
                          <div className="text-xs leading-none">
                            <span className="block text-white/60">BPM</span>
                            <span className={`font-black ${zoneColor}`}>ZONA</span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                ) : (
                  <div className="flex-1 flex items-center justify-center text-white/30">
                    Nenhum atleta com check-in ainda
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Footer mantido igual */}
      <footer className="h-16 bg-[#111] rounded-2xl border border-white/5 overflow-hidden flex items-center relative">
        {/* ... seu footer atual ... */}
      </footer>

      <style>{`
        /* seus estilos atuais */
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
