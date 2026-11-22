// src/components/HeartRateHistory.tsx
// ============================================================================
// Histórico de treinos de FC do atleta: lista os treinos salvos e permite
// reabrir o resumo completo (com o gráfico) de cada um.
//
// A seção começa fechada: batimento, duração e calorias são dados de saúde e não
// precisam ficar na tela do perfil o tempo todo. Dentro dela dá para apagar um
// treino ou o histórico inteiro.
// ============================================================================
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Heart, ChevronRight, ChevronDown, Loader2, Trash2, ArrowLeft, Flame, RefreshCw } from 'lucide-react';
import HeartRateSummary from './HeartRateSummary';
import {
  fetchHeartRateSessionsDetailed, deleteHeartRateSession, deleteAllHeartRateSessions,
  type StoredHrSession,
} from '../lib/heartRateSessions';
import type { Biometrics } from '../lib/heartRate';
import { hrvValidationLabel } from '../lib/hrvValidation';

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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<StoredHrSession | null>(null);
  const [open, setOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const loadSessions = () => {
    if (!userId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetchHeartRateSessionsDetailed(userId).then(({ sessions: rows, error }) => {
      if (!cancelled) {
        setSessions(rows);
        setLoadError(error);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  };

  useEffect(() => loadSessions(), [userId]);

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este treino de FC? Não dá para recuperar.')) return;
    const ok = await deleteHeartRateSession(id);
    if (ok) setSessions((prev) => prev.filter((s) => s.id !== id));
    else alert('Não foi possível excluir este treino.');
  };

  const handleClearAll = async () => {
    if (!userId || sessions.length === 0) return;
    const ok = confirm(
      `Excluir os ${sessions.length} treinos de FC salvos?\n\n` +
      'Os gráficos de batimento desses treinos somem. XP e BrazaCoins não mudam.',
    );
    if (!ok) return;
    setClearing(true);
    const done = await deleteAllHeartRateSessions(userId);
    setClearing(false);
    if (!done) { alert('Não foi possível excluir o histórico de FC.'); return; }
    setSessions([]);
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
          rrIntervalsMs={selected.rr_intervals_ms || []}
          deviceName={selected.device_name}
          bio={bio}
          deviceOverride={{
            calories: selected.calories ?? undefined,
            steps: selected.steps ?? undefined,
          }}
          hrvMsOverride={selected.hrv_metric === 'sdnn' ? selected.hrv_sdnn_ms : selected.hrv_metric === 'rmssd' ? selected.hrv_rmssd_ms : undefined}
          hrvMetricOverride={selected.hrv_metric ?? undefined}
          hrvAtOverride={selected.hrv_at ?? undefined}
          caloriesSourceOverride={selected.calories_source ?? null}
          closeLabel="Voltar ao histórico"
          onClose={() => setSelected(null)}
        />
      </section>
    );
  }

  return (
    <section className="bg-surface-container-low p-5 rounded-3xl border border-outline-variant/10 flex flex-col gap-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full text-left"
        aria-expanded={open}
      >
        <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic flex items-center gap-2">
          <Heart className="w-5 h-5 text-primary" /> HISTÓRICO DE FC
        </h3>
        <span className="flex items-center gap-2">
          {!loading && sessions.length > 0 && (
            <span className="text-[9px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
              {sessions.length}
            </span>
          )}
          <span className="text-[9px] text-on-surface-variant font-black uppercase tracking-widest">
            {open ? 'ocultar' : 'mostrar'}
          </span>
          <ChevronDown className={`w-5 h-5 text-on-surface-variant transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {!open && (
        <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest opacity-60">
          Batimento, duração e calorias ficam ocultos. Toque para abrir.
        </p>
      )}

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="hr-body"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
            className="flex flex-col gap-3"
          >
            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 text-white/30 animate-spin" />
              </div>
            ) : loadError ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <p className="text-red-400 text-[10px] font-bold uppercase tracking-widest leading-relaxed">
                  Não foi possível consultar o histórico de FC.
                </p>
                <p className="text-red-300/70 text-[8px] font-mono break-words">Detalhe: {loadError}</p>
                <button onClick={loadSessions} className="flex items-center gap-1.5 text-primary text-[10px] font-black uppercase tracking-widest">
                  <RefreshCw className="w-3 h-3" /> Tentar novamente
                </button>
              </div>
            ) : sessions.length === 0 ? (
              <p className="text-on-surface-variant/60 text-[11px] font-bold uppercase tracking-widest text-center py-4 leading-relaxed">
                Nenhum treino salvo ainda. Conecte um monitor de FC e, ao encerrar, o treino aparece aqui.
              </p>
            ) : (
              <>
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
                              {s.hrv_validation_status && s.hrv_validation_status !== 'valid'
                                ? ` · ${hrvValidationLabel(s.hrv_validation_status)}`
                                : s.hrv_metric ? ` · HRV ${Math.round((s.hrv_metric === 'sdnn' ? s.hrv_sdnn_ms : s.hrv_rmssd_ms) || 0)} ms` : ''}
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

                <button
                  onClick={handleClearAll}
                  disabled={clearing}
                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-2xl border border-error/20 text-error text-[10px] font-black uppercase tracking-widest hover:bg-error/10 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-3 h-3" /> {clearing ? 'Excluindo...' : 'Excluir histórico'}
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
