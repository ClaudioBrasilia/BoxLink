// src/components/HeartRateHistory.tsx
// ============================================================================
// Histórico de treinos de FC do atleta: lista os treinos salvos e permite
// reabrir o resumo completo (com o gráfico) de cada um.
// ============================================================================
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Heart, ChevronRight, Loader2, Trash2, ArrowLeft, Flame } from 'lucide-react';
import HeartRateSummary from './HeartRateSummary';
import {
  fetchHeartRateSessions, deleteHeartRateSession, type StoredHrSession,
} from '../lib/heartRateSessions';
import type { Biometrics } from '../lib/heartRate';

interface Props {
  userId: string | undefined;
  bio?: Biometrics;
}

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export default function HeartRateHistory({ userId, bio }: Props) {
  const [sessions, setSessions] = useState<StoredHrSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<StoredHrSession | null>(null);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    fetchHeartRateSessions(userId).then((rows) => {
      if (!cancelled) { setSessions(rows); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [userId]);

  const handleDelete = async (id: string) => {
    const ok = await deleteHeartRateSession(id);
    if (ok) setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  // Detalhe: reabre o resumo com o gráfico salvo (sem persistir de novo).
  if (selected) {
    return (
      <section className="bg-surface-container-low p-5 rounded-3xl border border-outline-variant/10 flex flex-col gap-4">
        <button onClick={() => setSelected(null)}
          className="flex items-center gap-1 text-on-surface-variant/70 text-[10px] font-black uppercase tracking-widest hover:text-primary transition-colors w-fit">
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao histórico
        </button>
        <HeartRateSummary
          samples={selected.samples || []}
          deviceName={selected.device_name}
          bio={bio}
          deviceOverride={{
            calories: selected.calories ?? undefined,
            steps: selected.steps ?? undefined,
          }}
          caloriesSourceOverride={selected.calories_source ?? null}
          closeLabel="Voltar ao histórico"
          onClose={() => setSelected(null)}
        />
      </section>
    );
  }

  return (
    <section className="bg-surface-container-low p-5 rounded-3xl border border-outline-variant/10 flex flex-col gap-4">
      <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic flex items-center gap-2">
        <Heart className="w-5 h-5 text-primary" /> HISTÓRICO DE FC
      </h3>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 text-white/30 animate-spin" />
        </div>
      ) : sessions.length === 0 ? (
        <p className="text-on-surface-variant/60 text-[11px] font-bold uppercase tracking-widest text-center py-4 leading-relaxed">
          Nenhum treino salvo ainda. Conecte um monitor de FC e, ao encerrar, o treino aparece aqui.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {sessions.map((s) => (
              <motion.div key={s.id}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
                className="bg-surface-container-highest/40 border border-outline-variant/10 rounded-2xl p-3 flex items-center gap-3 hover:border-primary/30 transition-all">
                <button onClick={() => setSelected(s)} className="flex items-center gap-3 flex-1 text-left min-w-0">
                  <div className="p-2 rounded-xl bg-primary/10 shrink-0">
                    <Activity className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-on-surface text-xs font-black italic">
                      {s.avg_bpm} <span className="text-[9px] text-white/40">bpm méd</span>
                      <span className="text-white/30"> · </span>
                      {fmtDuration(s.duration_sec)}
                    </p>
                    <p className="text-on-surface-variant/60 text-[9px] font-black uppercase tracking-widest truncate">
                      {fmtDate(s.ended_at || s.started_at)}
                      {s.max_bpm ? ` · máx ${s.max_bpm}` : ''}
                      {s.calories ? ` · ${s.calories} kcal` : ''}
                    </p>
                  </div>
                  {s.calories ? <Flame className="w-3.5 h-3.5 text-orange-400/70 shrink-0" /> : null}
                  <ChevronRight className="w-4 h-4 text-white/30 shrink-0" />
                </button>
                <button onClick={() => handleDelete(s.id)} aria-label="Excluir treino"
                  className="p-1.5 rounded-lg text-white/25 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}
