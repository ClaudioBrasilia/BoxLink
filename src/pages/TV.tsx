import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Timer, Trophy, Zap, Swords, Maximize, Activity, Users, Play, Pause, RotateCcw, ChevronLeft, ChevronRight, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
  const [liveWorkoutMode, setLiveWorkoutMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    const clockInterval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clockInterval);
  }, []);

  const fetchData = useCallback(async () => {
    // ← Cole aqui TODO o seu fetchData original (o que você tinha antes)
    // Para não ficar gigante, mantenha exatamente o fetchData que você enviou na primeira mensagem.
    // Se precisar, posso te ajudar a ajustar.
  }, []);

  // ... mantenha todos os useEffects que você já tinha (realtime, athlete rotation, etc.)

  const getMockBPM = () => Math.floor(Math.random() * 45) + 130;

  // ====================== RETURN ======================
  return (
    <div className="min-h-screen bg-black text-white font-sans overflow-hidden flex flex-col p-6 gap-6 relative select-none">
      {/* Header */}
      <header className="flex justify-between items-center bg-[#111] rounded-[2rem] p-6 border border-white/5 shadow-2xl">
        {/* Seu header original aqui - copie do seu arquivo antigo */}
        <div className="flex items-center gap-6">
          {/* logo + nome */}
        </div>

        <div className="flex items-center gap-6">
          {/* timer */}
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => setLiveWorkoutMode(!liveWorkoutMode)}
            className={cn("flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-widest",
              liveWorkoutMode ? "bg-red-500 text-white" : "bg-primary text-black hover:bg-primary/90"
            )}>
            <Heart className="w-5 h-5" />
            {liveWorkoutMode ? "SAIR DO MODO AO VIVO" : "MODO TREINO AO VIVO"}
          </button>
          <button onClick={() => { /* toggle fullscreen */ }} className="p-4 bg-white/5 rounded-2xl border border-white/10">
            <Maximize className="w-6 h-6" />
          </button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-12 gap-6 overflow-hidden">
        {/* WOD - Esquerda */}
        <div className={`flex flex-col gap-6 ${liveWorkoutMode ? 'col-span-7' : 'col-span-8'}`}>
          {/* Tabs */}
          <div className="flex items-center justify-between bg-[#111] rounded-3xl p-3 border border-white/5">
            {/* Cole aqui suas tabs de WARM-UP, SKILL, THE WOD */}
          </div>

          {/* Conteúdo do WOD */}
          <div className="flex-1 relative">
            <AnimatePresence mode="wait">
              {/* Cole aqui suas 3 seções motion (warmup, skill, wod) */}
            </AnimatePresence>
          </div>
        </div>

        {/* Direita */}
        <div className={`flex flex-col gap-6 ${liveWorkoutMode ? 'col-span-5' : 'col-span-4'}`}>
          {/* Ranking */}
          <section className="bg-[#111] rounded-[2.5rem] p-5 border border-white/5" style={{ flex: liveWorkoutMode ? '1 1 0' : '2 1 0' }}>
            {/* Cole aqui todo o seu código do TOP 3 + ranking */}
          </section>

          {/* Frequência Cardíaca - só no modo live */}
          {liveWorkoutMode && (
            <section className="bg-[#111] rounded-[2.5rem] p-6 border border-white/5 flex-1 flex flex-col">
              <div className="flex justify-between items-center mb-5">
                <div className="flex items-center gap-3">
                  <Heart className="w-8 h-8 text-red-500" />
                  <div>
                    <h3 className="text-2xl font-headline font-black">FREQUÊNCIA CARDÍACA</h3>
                    <p className="text-red-500 text-sm font-black">AO VIVO • TREINO ATUAL</p>
                  </div>
                </div>
                <span className="bg-red-500/20 text-red-500 px-4 py-1 rounded-xl font-black">
                  {data?.checkins?.length || 0} ATLETAS
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                {data?.checkins?.length > 0 ? data.checkins.map((c: any) => {
                  const profile = c?.profiles;
                  const bpm = getMockBPM();
                  const color = bpm >= 160 ? 'text-red-500' : bpm >= 140 ? 'text-orange-500' : 'text-emerald-500';

                  return (
                    <div key={c.id} className="bg-zinc-900 rounded-2xl p-5 flex items-center justify-between border border-white/10">
                      <div className="flex items-center gap-4">
                        <AvatarPreview equipped={profile?.avatar_equipped} size="md" />
                        <p className="font-headline font-black text-xl">{profile?.name?.split(' ')[0]}</p>
                      </div>
                      <div className="text-right">
                        <div className={`text-6xl font-black tabular-nums ${color}`}>{bpm}</div>
                        <div className="text-xs text-white/60 -mt-1">BPM</div>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="h-full flex items-center justify-center text-white/40">
                    Aguardando atletas...
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Footer - mantenha o seu original */}
      <footer>...</footer>
    </div>
  );
}
