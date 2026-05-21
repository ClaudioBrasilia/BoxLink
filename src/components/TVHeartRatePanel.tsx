// src/components/TVHeartRatePanel.tsx
// Painel exibido na TV com a frequência cardíaca de todos os atletas
// que conectaram seus relógios. Atualiza via Supabase Realtime.

import React, { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';

interface AthleteHR {
  user_id: string;
  bpm: number;
  updated_at: string;
  name?: string;
  avatar_equipped?: any;
}

// Cor e zona com base no BPM
function getZone(bpm: number): { label: string; color: string; glow: string; bar: string } {
  if (bpm < 100) return { label: 'REPOUSO',    color: '#60a5fa', glow: 'rgba(96,165,250,0.4)',   bar: 'bg-blue-400' };
  if (bpm < 120) return { label: 'AQUECIMENTO',color: '#4ade80', glow: 'rgba(74,222,128,0.4)',   bar: 'bg-green-400' };
  if (bpm < 140) return { label: 'AERÓBICO',   color: '#facc15', glow: 'rgba(250,204,21,0.4)',   bar: 'bg-yellow-400' };
  if (bpm < 160) return { label: 'ANAERÓBICO', color: '#fb923c', glow: 'rgba(251,146,60,0.4)',   bar: 'bg-orange-400' };
  return               { label: 'MÁXIMO ⚡',   color: '#f87171', glow: 'rgba(248,113,113,0.5)',   bar: 'bg-red-400' };
}

// Barra de intensidade (0-100%)
function intensityPercent(bpm: number): number {
  const min = 50;
  const max = 200;
  return Math.min(100, Math.max(0, ((bpm - min) / (max - min)) * 100));
}

export default function TVHeartRatePanel() {
  const [athletes, setAthletes] = useState<AthleteHR[]>([]);

  useEffect(() => {
    // Busca inicial
    const fetchHR = async () => {
      // Busca registros recentes (últimos 10 minutos)
      const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { data: hrData } = await supabase
        .from('heart_rate_live')
        .select('user_id, bpm, updated_at')
        .gte('updated_at', cutoff)
        .order('bpm', { ascending: false });

      if (!hrData || hrData.length === 0) {
        setAthletes([]);
        return;
      }

      // Busca nomes dos atletas
      const ids = hrData.map((r: any) => r.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, avatar_equipped')
        .in('id', ids);

      const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]));

      const enriched: AthleteHR[] = hrData.map((r: any) => ({
        ...r,
        name: profileMap[r.user_id]?.name || 'Atleta',
        avatar_equipped: profileMap[r.user_id]?.avatar_equipped,
      }));

      setAthletes(enriched);
    };

    fetchHR();

    // Realtime: escuta mudanças na tabela heart_rate_live
    const channel = supabase
      .channel('tv-heart-rate')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'heart_rate_live',
      }, () => {
        fetchHR();
      })
      .subscribe();

    // Atualiza a cada 5 segundos para remover atletas stale
    const interval = setInterval(fetchHR, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  if (athletes.length === 0) return null;

  return (
    <section className="bg-[#111] rounded-[2.5rem] border border-white/5 p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-red-400 animate-pulse" />
          <h3 className="text-sm font-headline font-black text-white italic uppercase tracking-tight">
            FC AO VIVO
          </h3>
        </div>
        <span className="bg-red-500/20 border border-red-500/30 text-red-400 px-2 py-0.5 rounded-full font-headline font-black text-xs italic">
          {athletes.length} relógio{athletes.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Cards de atletas */}
      <div className="flex flex-col gap-3">
        <AnimatePresence>
          {athletes.map((athlete) => {
            const zone = getZone(athlete.bpm);
            const pct = intensityPercent(athlete.bpm);
            const firstName = athlete.name?.split(' ')[0] || 'Atleta';

            return (
              <motion.div
                key={athlete.user_id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col gap-2"
              >
                {/* Linha principal: nome + BPM */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {/* Avatar initials */}
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center font-headline font-black text-sm shrink-0"
                      style={{
                        backgroundColor: zone.color + '20',
                        border: `1px solid ${zone.color}40`,
                        color: zone.color,
                      }}
                    >
                      {firstName[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-black text-xs uppercase italic truncate leading-none">
                        {firstName}
                      </p>
                      <p className="text-[9px] font-black uppercase tracking-widest mt-0.5"
                         style={{ color: zone.color }}>
                        {zone.label}
                      </p>
                    </div>
                  </div>

                  {/* BPM em destaque */}
                  <div className="flex items-baseline gap-1 shrink-0">
                    <motion.span
                      key={athlete.bpm}
                      initial={{ scale: 1.3, opacity: 0.6 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="font-headline font-black text-2xl italic tabular-nums"
                      style={{
                        color: zone.color,
                        textShadow: `0 0 20px ${zone.glow}`,
                      }}
                    >
                      {athlete.bpm}
                    </motion.span>
                    <span className="text-[9px] font-black uppercase" style={{ color: zone.color }}>
                      BPM
                    </span>
                  </div>
                </div>

                {/* Barra de intensidade */}
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${zone.bar}`}
                    style={{ boxShadow: `0 0 8px ${zone.glow}` }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Legenda de zonas compacta */}
      <div className="flex gap-2 flex-wrap pt-1 border-t border-white/5">
        {[
          { label: 'Repouso',    color: '#60a5fa', max: '<100' },
          { label: 'Aquecimento',color: '#4ade80', max: '<120' },
          { label: 'Aeróbico',  color: '#facc15', max: '<140' },
          { label: 'Anaeróbico',color: '#fb923c', max: '<160' },
          { label: 'Máximo',    color: '#f87171', max: '160+' },
        ].map(z => (
          <div key={z.label} className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: z.color }} />
            <span className="text-[8px] font-black uppercase" style={{ color: z.color }}>
              {z.label} {z.max}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
