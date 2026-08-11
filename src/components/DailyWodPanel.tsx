import { useState, useEffect, useMemo, useRef } from 'react';
import { Timer, Hash, Check, Send, Pencil, X, ChevronDown, Play } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { isTimeBasedType, postWodDefinition } from '../lib/dailyWods';
import { isAmrapType } from '../lib/pace';
import { useDailyWodRows, WodResultRow } from '../hooks/useDailyWodRows';

// Mesmos tipos que o coach posta no Box, mais OUTRO (o atleta individual
// treina coisa que não cabe em nenhum formato).
const WOD_TYPES = ['FOR TIME', 'AMRAP', 'EMOM', 'TABATA', 'HERO WOD', 'OUTRO'];

/** Tipos que rodam contra o relógio: AMRAP e EMOM têm duração prescrita, FOR
 *  TIME tem time cap. TABATA fica de fora — a duração dele sai dos rounds. */
const usesMinutes = (type: string) =>
  isAmrapType(type) || (type || '').toUpperCase() === 'EMOM' || isTimeBasedType(type);

const minutesLabel = (type: string) =>
  isAmrapType(type) ? 'Duração (min)'
    : (type || '').toUpperCase() === 'EMOM' ? 'Total de minutos'
    : isTimeBasedType(type) ? 'Time cap (min)'
    : 'Duração (min)';

const parseIntOrNull = (v: string): number | null => {
  const n = parseInt(v.trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const parseLoadOrNull = (v: string): number | null => {
  const n = parseFloat(v.trim().replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
};

interface DailyWodPanelProps {
  /** Muda quando um WOD do dia é postado/atualizado — pai pode reagir. */
  onChange?: () => void;
  /** Muda quando um resultado é gravado por fora deste card — força recarregar. */
  refreshSignal?: number;
  /** Treinar o WOD abre o cronômetro já carregado com ele (inclusive com os
   *  números: duração do AMRAP, time cap, carga sugerida). */
  onStartWod?: (row: WodResultRow) => void;
  /** Cronômetro livre, sem WOD pré-carregado. */
  onFreeTrain?: () => void;
  /** Muda quando o pai pede pra abrir o formulário de postar WOD — o botão
   *  principal da Início do individual é quem chama, então este painel não
   *  precisa repetir um botão próprio pra isso. */
  openFormSignal?: number;
}

/**
 * Os WODs que o próprio atleta postou hoje, em cards compactos (o WOD só
 * aparece por inteiro quando o card é aberto). O ranking de quem mais treinou
 * fica na Liga, em WodPlacarRanking.
 */
export default function DailyWodPanel({ onChange, refreshSignal, onStartWod, onFreeTrain, openFormSignal }: DailyWodPanelProps) {
  const { user } = useAuth();
  const toast = useToast();

  const { rows, reload } = useDailyWodRows(refreshSignal);

  const [saving, setSaving] = useState(false);
  // Formulário fechado por padrão — só abre pra postar um novo WOD ou editar
  // um já postado (evita a tela poluída com campos abertos o tempo todo).
  const [formOpen, setFormOpen] = useState(false);
  // Linha sendo editada (null = criando um WOD novo).
  const [editingRowId, setEditingRowId] = useState<string | null>(null);

  const [wodName, setWodName] = useState('');
  const [wodType, setWodType] = useState('FOR TIME');
  const [description, setDescription] = useState('');
  const [scaling, setScaling] = useState<'rx' | 'scaled'>('rx');
  // Total de reps prescritas (FOR TIME) — opcional, mesma conta do Box: com o
  // tempo do resultado vira ritmo (reps/min) no placar.
  const [totalReps, setTotalReps] = useState('');
  // Números do AMRAP (mesma dupla que o coach preenche no Box): reps de um
  // round completo + duração. Juntos, transformam o "5+12" do cronômetro em
  // ritmo (reps/min) no placar.
  const [repsPerRound, setRepsPerRound] = useState('');
  const [timeCapMinutes, setTimeCapMinutes] = useState('');
  // Carga sugerida do WOD — a prescrição ("Thruster 43kg"), não a carga que
  // o atleta acabou usando (essa entra junto com o resultado).
  const [targetLoadKg, setTargetLoadKg] = useState('');
  const [warmup, setWarmup] = useState('');
  const [skill, setSkill] = useState('');
  // Aquecimento e skill ficam recolhidos: são a parte da ficha do Box que
  // nem todo atleta individual prescreve, e abrir tudo polui o formulário.
  const [extrasOpen, setExtrasOpen] = useState(false);
  // Cards abertos — fechados por padrão pra caber vários WODs do dia na tela.
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const formRef = useRef<HTMLDivElement>(null);

  // Um atleta pode postar mais de um WOD no mesmo dia (ex: treino dobrado).
  const myRows = useMemo(() => rows.filter(r => r.user_id === user?.id), [rows, user?.id]);

  const openNewForm = () => {
    setEditingRowId(null);
    setWodName(''); setWodType('FOR TIME'); setDescription(''); setScaling('rx'); setTotalReps('');
    setRepsPerRound(''); setTimeCapMinutes(''); setTargetLoadKg('');
    setWarmup(''); setSkill(''); setExtrasOpen(false);
    setFormOpen(true);
  };

  const openEditForm = (row: WodResultRow) => {
    setEditingRowId(row.id);
    setWodName(row.wod_name); setWodType(row.wod_type);
    setDescription(row.description || ''); setScaling(row.scaling);
    setTotalReps(row.total_reps != null ? String(row.total_reps) : '');
    setRepsPerRound(row.reps_per_round != null ? String(row.reps_per_round) : '');
    setTimeCapMinutes(row.time_cap_minutes != null ? String(row.time_cap_minutes) : '');
    setTargetLoadKg(row.target_load_kg != null ? String(row.target_load_kg) : '');
    setWarmup(row.warmup || ''); setSkill(row.skill || '');
    // Já preenchidos, aquecimento/skill abrem junto — senão pareceriam perdidos.
    setExtrasOpen(!!(row.warmup || row.skill));
    setFormOpen(true);
  };

  const closeForm = () => setFormOpen(false);

  // O botão "Postar WOD" da Início fica lá em cima; ao abrir o formulário
  // daqui, traz ele pra vista pra não parecer que nada aconteceu.
  useEffect(() => {
    if (!openFormSignal) return;
    openNewForm();
  }, [openFormSignal]);

  useEffect(() => {
    if (formOpen) formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [formOpen]);

  const handlePostDefinition = async () => {
    if (!user) return;
    if (!wodName.trim()) { toast.warning('Dê um nome ao WOD.'); return; }
    setSaving(true);
    try {
      await postWodDefinition({
        userId: user.id, wodName: wodName.trim(), wodType, description: description.trim(), scaling,
        id: editingRowId || undefined,
        // Cada número só é gravado no tipo de WOD em que ele significa algo —
        // mesma regra do painel do coach no Box.
        totalReps: isTimeBasedType(wodType) ? parseIntOrNull(totalReps) : null,
        repsPerRound: isAmrapType(wodType) ? parseIntOrNull(repsPerRound) : null,
        timeCapMinutes: usesMinutes(wodType) ? parseIntOrNull(timeCapMinutes) : null,
        targetLoadKg: parseLoadOrNull(targetLoadKg),
        warmup: warmup.trim() || null,
        skill: skill.trim() || null,
      });
      toast.success(editingRowId ? 'WOD atualizado!' : 'WOD postado! Toque nele para treinar.');
      setFormOpen(false);
      onChange?.();
      await reload();
    } catch (err: any) {
      console.error('Error posting wod definition:', err);
      toast.error('Erro ao postar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-6 mb-4 flex flex-col gap-3">
      {myRows.map(row => {
        const open = !!expandedRows[row.id];
        const trained = !!row.result;
        return (
          <div
            key={row.id}
            className={cn('bg-surface-container rounded-3xl border overflow-hidden',
              trained ? 'border-primary/20' : 'border-secondary/20')}
          >
            {/* Caixa compacta: só o essencial. O WOD inteiro aparece ao abrir. */}
            <button
              onClick={() => setExpandedRows(prev => ({ ...prev, [row.id]: !prev[row.id] }))}
              className="w-full p-4 flex items-center gap-3 text-left"
            >
              {isTimeBasedType(row.wod_type)
                ? <Timer className="w-5 h-5 text-primary flex-shrink-0" />
                : <Hash className="w-5 h-5 text-primary flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-headline font-black text-on-surface uppercase italic truncate">{row.wod_name}</p>
                <p className="text-[9px] text-on-surface-variant font-bold uppercase tracking-widest truncate">
                  {row.wod_type} • {row.scaling === 'rx' ? 'RX' : 'Scaled'}
                  {row.time_cap_minutes != null ? ` • ${row.time_cap_minutes}min` : ''}
                  {/* Antes de treinar mostra a carga sugerida; depois, a usada. */}
                  {row.load_kg != null ? ` • ${row.load_kg}kg`
                    : row.target_load_kg != null ? ` • ${row.target_load_kg}kg sugerida` : ''}
                </p>
              </div>
              {trained ? (
                <span className="text-base font-headline font-black text-primary italic flex-shrink-0">{row.result}</span>
              ) : (
                <span className="text-[9px] font-black text-secondary uppercase tracking-widest flex-shrink-0">⏳ falta treinar</span>
              )}
              <ChevronDown className={cn('w-4 h-4 text-on-surface-variant transition-transform flex-shrink-0', open && 'rotate-180')} />
            </button>

            {open && (
              <div className="px-4 pb-4 flex flex-col gap-3 border-t border-outline-variant/10 pt-3">
                {row.warmup && (
                  <div>
                    <p className="text-[9px] text-on-surface-variant font-black uppercase tracking-widest mb-1 opacity-70">Aquecimento</p>
                    <p className="text-xs text-on-surface-variant font-medium leading-relaxed whitespace-pre-wrap">{row.warmup}</p>
                  </div>
                )}
                {row.skill && (
                  <div>
                    <p className="text-[9px] text-on-surface-variant font-black uppercase tracking-widest mb-1 opacity-70">Skill</p>
                    <p className="text-xs text-on-surface-variant font-medium leading-relaxed whitespace-pre-wrap">{row.skill}</p>
                  </div>
                )}
                {row.description ? (
                  <div>
                    {(row.warmup || row.skill) && (
                      <p className="text-[9px] text-primary font-black uppercase tracking-widest mb-1">WOD</p>
                    )}
                    <p className="text-xs text-on-surface-variant font-medium leading-relaxed whitespace-pre-wrap">{row.description}</p>
                  </div>
                ) : (
                  <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest italic opacity-60">
                    Sem movimentos anotados
                  </p>
                )}
                {/* Os números prescritos do WOD — os mesmos que o coach
                    cadastra no Box e que liberam o ritmo (reps/min) no placar. */}
                {(row.time_cap_minutes != null || row.reps_per_round != null || row.total_reps != null || row.target_load_kg != null) && (
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      row.time_cap_minutes != null ? [minutesLabel(row.wod_type), `${row.time_cap_minutes} min`] : null,
                      row.reps_per_round != null ? ['Reps/round', String(row.reps_per_round)] : null,
                      row.total_reps != null ? ['Total de reps', String(row.total_reps)] : null,
                      row.target_load_kg != null ? ['Carga sugerida', `${row.target_load_kg} kg`] : null,
                    ].filter(Boolean).map(([label, value]) => (
                      <span key={label as string}
                        className="bg-surface-container-highest/60 rounded-xl px-2.5 py-1.5 text-[9px] font-black text-on-surface-variant uppercase tracking-widest">
                        {label} <span className="text-primary">{value}</span>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditForm(row)}
                    className="flex items-center gap-1.5 text-[10px] font-black text-on-surface-variant uppercase tracking-widest hover:text-primary transition-all"
                  >
                    <Pencil className="w-3 h-3" /> Editar
                  </button>
                  {!trained && onStartWod && (
                    <button
                      onClick={() => onStartWod(row)}
                      className="ml-auto bg-primary text-background px-4 py-2.5 rounded-xl font-headline font-black text-[10px] uppercase italic flex items-center gap-1.5 hover:opacity-90 transition-all"
                    >
                      <Play className="w-3.5 h-3.5" /> Treinar agora
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {formOpen ? (
        <div ref={formRef} className="bg-surface-container rounded-3xl p-5 border border-outline-variant/10 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-black text-on-surface uppercase tracking-widest">
              {editingRowId ? 'Editar WOD' : 'Poste um WOD'}
            </p>
            <button onClick={closeForm} className="text-on-surface-variant hover:text-on-surface transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>
          <input
            type="text"
            placeholder="Nome do WOD (ex: Fran, meu AMRAP)"
            value={wodName}
            onChange={e => setWodName(e.target.value)}
            className="w-full bg-surface-container-highest rounded-2xl px-4 py-3 text-sm font-bold text-on-surface outline-none"
          />
          <select
            value={wodType}
            onChange={e => setWodType(e.target.value)}
            className="w-full bg-surface-container-highest rounded-2xl px-4 py-3 text-sm font-medium text-on-surface outline-none"
          >
            {WOD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <textarea
            placeholder="Movimentos (ex: 21-15-9 Thruster + Pull-up)"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={4}
            className="w-full bg-surface-container-highest rounded-2xl px-4 py-3 text-sm font-medium text-on-surface outline-none resize-none"
          />
          {/* Números do WOD, por tipo — mesma ficha que o coach preenche no
              Box. FOR TIME precisa de total de reps (÷ tempo = ritmo); AMRAP,
              de reps por round + duração (reps completadas ÷ duração). */}
          {isTimeBasedType(wodType) && (
            <div className="flex flex-col gap-1">
              <input
                type="number"
                inputMode="numeric"
                placeholder="Total de reps do WOD (ex: 165)"
                value={totalReps}
                onChange={e => setTotalReps(e.target.value)}
                className="w-full bg-secondary/5 border border-secondary/20 rounded-2xl px-4 py-3 text-sm font-medium text-on-surface outline-none"
              />
              <p className="text-[9px] text-on-surface-variant font-bold uppercase tracking-widest px-1">
                Opcional — libera o ritmo (reps/min) no placar
              </p>
            </div>
          )}
          {isAmrapType(wodType) && (
            <div className="flex flex-col gap-1">
              <input
                type="number"
                inputMode="numeric"
                placeholder="Reps de um round completo (ex: 30)"
                value={repsPerRound}
                onChange={e => setRepsPerRound(e.target.value)}
                className="w-full bg-secondary/5 border border-secondary/20 rounded-2xl px-4 py-3 text-sm font-medium text-on-surface outline-none"
              />
              <p className="text-[9px] text-on-surface-variant font-bold uppercase tracking-widest px-1">
                Opcional — com a duração, transforma "5+12" em ritmo (reps/min)
              </p>
            </div>
          )}
          {usesMinutes(wodType) && (
            <div className="flex flex-col gap-1">
              <input
                type="number"
                inputMode="numeric"
                placeholder={`${minutesLabel(wodType)} (ex: ${isAmrapType(wodType) ? '20' : '12'})`}
                value={timeCapMinutes}
                onChange={e => setTimeCapMinutes(e.target.value)}
                className="w-full bg-primary/5 border border-primary/20 rounded-2xl px-4 py-3 text-sm font-medium text-on-surface outline-none"
              />
              <p className="text-[9px] text-on-surface-variant font-bold uppercase tracking-widest px-1">
                {isTimeBasedType(wodType) && !isAmrapType(wodType)
                  ? 'Opcional — o cronômetro já abre com esse time cap'
                  : 'O cronômetro já abre com esse tempo'}
              </p>
            </div>
          )}
          <div className="flex flex-col gap-1">
            <input
              type="text"
              inputMode="decimal"
              placeholder="Carga sugerida (kg) — ex: 43"
              value={targetLoadKg}
              onChange={e => setTargetLoadKg(e.target.value)}
              className="w-full bg-surface-container-highest rounded-2xl px-4 py-3 text-sm font-medium text-on-surface outline-none"
            />
            <p className="text-[9px] text-on-surface-variant font-bold uppercase tracking-widest px-1">
              Opcional — a carga prescrita do WOD (a usada você registra ao treinar)
            </p>
          </div>

          {/* Aquecimento e skill: a parte da ficha do Box que fica recolhida
              até o atleta querer prescrever o treino inteiro. */}
          <button
            type="button"
            onClick={() => setExtrasOpen(o => !o)}
            className="flex items-center gap-1.5 text-[10px] font-black text-on-surface-variant uppercase tracking-widest hover:text-primary transition-all"
          >
            <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', extrasOpen && 'rotate-180')} />
            Aquecimento e skill (opcional)
          </button>
          {extrasOpen && (
            <>
              <textarea
                placeholder="Aquecimento (ex: 3 rounds — 10 air squat + 10 PVC pass through)"
                value={warmup}
                onChange={e => setWarmup(e.target.value)}
                rows={3}
                className="w-full bg-surface-container-highest rounded-2xl px-4 py-3 text-sm font-medium text-on-surface outline-none resize-none"
              />
              <textarea
                placeholder="Skill (ex: 10 min de técnica de muscle-up)"
                value={skill}
                onChange={e => setSkill(e.target.value)}
                rows={3}
                className="w-full bg-surface-container-highest rounded-2xl px-4 py-3 text-sm font-medium text-on-surface outline-none resize-none"
              />
            </>
          )}
          <div className="flex gap-2">
            {(['rx', 'scaled'] as const).map(s => (
              <button key={s} onClick={() => setScaling(s)}
                className={cn('flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
                  scaling === s
                    ? s === 'rx' ? 'bg-primary text-background' : 'bg-secondary text-background'
                    : 'bg-surface-container-highest text-on-surface-variant')}>
                {s === 'rx' ? 'RX' : 'Scaled'}
              </button>
            ))}
          </div>
          <button
            onClick={handlePostDefinition}
            disabled={saving || !wodName.trim()}
            className="w-full bg-primary text-background py-3 rounded-xl font-headline font-black text-xs uppercase italic flex items-center justify-center gap-2 disabled:opacity-40 hover:opacity-90 transition-all"
          >
            {saving ? <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin" />
              : editingRowId ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
            {editingRowId ? 'Atualizar WOD' : 'Postar WOD'}
          </button>
        </div>
      ) : onFreeTrain ? (
        /* Postar WOD agora é o botão principal da Início — aqui fica só a
           saída pra quem quer treinar sem entrar no placar. */
        <button
          onClick={onFreeTrain}
          className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest hover:text-primary transition-all text-center py-1"
        >
          Ou treinar sem postar (cronômetro livre)
        </button>
      ) : null}
    </div>
  );
}
