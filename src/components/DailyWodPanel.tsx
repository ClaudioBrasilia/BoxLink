import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Calendar, Timer, Hash, Check, Trophy, Send, Pencil, X, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn, compareBy } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { dailyWodDate, parseWodResult, isTimeBasedType, postWodDefinition } from '../lib/dailyWods';
import AvatarPreview from './AvatarPreview';
import AthletePhoto from './AthletePhoto';
import { AvatarSlot } from '../types';

const WOD_TYPES = ['FOR TIME', 'AMRAP', 'EMOM', 'TABATA', 'OUTRO'];

interface WodResultRow {
  id: string;
  user_id: string;
  wod_name: string;
  wod_type: string;
  description: string | null;
  result: string | null;
  scaling: 'rx' | 'scaled';
  load_kg: number | null;
  name: string;
  level: number;
  avatar_equipped?: any;
  photo_url?: string | null;
}

interface WodGroup {
  name: string;
  timeBased: boolean;
  description: string | null;
  ranked: WodResultRow[];
}

interface DailyWodPanelProps {
  /** Muda quando um WOD do dia é postado/atualizado — pai pode reagir. */
  onChange?: () => void;
  /** Muda quando um resultado é gravado por fora deste card — força recarregar. */
  refreshSignal?: number;
  /** Tocar num WOD "falta treinar" abre o cronômetro já carregado com ele. */
  onStartWod?: (row: { id: string; wod_name: string; wod_type: string; description: string | null; scaling: 'rx' | 'scaled' }) => void;
  /** Cronômetro livre, sem WOD pré-carregado. */
  onFreeTrain?: () => void;
  /** Muda quando o pai pede pra abrir o formulário de postar WOD — o botão
   *  principal da Início do individual é quem chama, então este painel não
   *  precisa repetir um botão próprio pra isso. */
  openFormSignal?: number;
}

export default function DailyWodPanel({ onChange, refreshSignal, onStartWod, onFreeTrain, openFormSignal }: DailyWodPanelProps) {
  const { user } = useAuth();
  const toast = useToast();

  const date = useMemo(() => dailyWodDate(), []);

  const [rows, setRows] = useState<WodResultRow[]>([]);
  const [loading, setLoading] = useState(true);
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
  // Grupos do ranking com "ver movimentos" expandido — antes o placar só
  // mostrava o nome do WOD, sem dar pra saber do que se tratava.
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const formRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: resultsData } = await supabase
        .from('daily_wod_results')
        .select('*')
        .eq('wod_date', date);

      const results = resultsData || [];
      const ids = [...new Set(results.map((r: any) => r.user_id))];
      const profilesMap: Record<string, any> = {};
      if (ids.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, name, level, avatar_equipped, photo_url')
          .in('id', ids);
        (profs || []).forEach((p: any) => { profilesMap[p.id] = p; });
      }

      setRows(results.map((r: any) => ({
        id: r.id,
        user_id: r.user_id,
        wod_name: r.wod_name ?? 'WOD',
        wod_type: r.wod_type ?? 'FOR TIME',
        description: r.description ?? null,
        result: r.result ?? null,
        scaling: r.scaling ?? 'rx',
        load_kg: r.load_kg ?? null,
        name: profilesMap[r.user_id]?.name ?? 'Atleta',
        level: profilesMap[r.user_id]?.level ?? 1,
        avatar_equipped: profilesMap[r.user_id]?.avatar_equipped,
        photo_url: profilesMap[r.user_id]?.photo_url ?? null,
      })));
    } catch (err) {
      console.error('Error loading placar:', err);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { load(); }, [load, refreshSignal]);

  // Um atleta pode postar mais de um WOD no mesmo dia (ex: treino dobrado).
  const myRows = useMemo(() => rows.filter(r => r.user_id === user?.id), [rows, user?.id]);

  // Ranking só considera quem já treinou — definição sem resultado não conta.
  const groups = useMemo<WodGroup[]>(() => {
    const trainedRows = rows.filter(r => r.result);
    const map: Record<string, WodResultRow[]> = {};
    trainedRows.forEach(r => {
      const key = (r.wod_name || 'WOD').trim().toLowerCase();
      (map[key] ||= []).push(r);
    });
    return Object.values(map).map(list => {
      const timeBased = isTimeBasedType(list[0].wod_type);
      const ranked = [...list].sort(compareBy<WodResultRow>(
        (a, b) => {
          const va = parseWodResult(a.result!, timeBased);
          const vb = parseWodResult(b.result!, timeBased);
          return timeBased ? va - vb : vb - va;
        },
        (a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'),
      ));
      return { name: list[0].wod_name || 'WOD', timeBased, description: list[0].description, ranked };
    }).sort((a, b) => b.ranked.length - a.ranked.length);
  }, [rows]);

  const openNewForm = () => {
    setEditingRowId(null);
    setWodName(''); setWodType('FOR TIME'); setDescription(''); setScaling('rx');
    setFormOpen(true);
  };

  const openEditForm = (row: WodResultRow) => {
    setEditingRowId(row.id);
    setWodName(row.wod_name); setWodType(row.wod_type);
    setDescription(row.description || ''); setScaling(row.scaling);
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
      });
      toast.success(editingRowId ? 'WOD atualizado!' : 'WOD postado! Toque em "Iniciar Meu WOD" para treinar.');
      setFormOpen(false);
      onChange?.();
      await load();
    } catch (err: any) {
      console.error('Error posting wod definition:', err);
      toast.error('Erro ao postar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const Avatar = ({ r, className }: { r: WodResultRow; className?: string }) =>
    r.photo_url ? (
      <AthletePhoto photoUrl={r.photo_url} name={r.name} size="sm" ringColor="border-outline-variant/20" className={className} />
    ) : (
      <div className={cn('rounded-full overflow-hidden border-2 border-outline-variant/20 bg-surface-container-highest', className)}>
        <AvatarPreview equipped={(r.avatar_equipped || {}) as AvatarSlot} size="sm" className="w-full h-full border-none shadow-none" />
      </div>
    );

  return (
    <div className="mx-6 mb-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-headline font-black italic text-on-surface uppercase tracking-tight">Placar de WODs</h2>
          <p className="text-on-surface-variant text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-1">
            <Calendar className="w-3 h-3" /> Poste o seu e veja quem mais treinou hoje
          </p>
        </div>
        <div className="w-10 h-10 rounded-full bg-secondary/10 border border-secondary/20 flex items-center justify-center">
          <Trophy className="w-5 h-5 text-secondary" />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {myRows.map(row => (
          row.result ? (
            /* Treinado: resultado é gravado pelo cronômetro/Novo Registro, não aqui */
            <div key={row.id} className="bg-surface-container rounded-3xl p-5 border border-primary/20 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-black text-on-surface uppercase tracking-widest">Seu WOD</p>
                <span className="text-[10px] font-black text-primary uppercase tracking-widest">✓ Treinado</span>
              </div>
              <div className="flex items-center gap-3">
                {isTimeBasedType(row.wod_type) ? <Timer className="w-4 h-4 text-primary flex-shrink-0" /> : <Hash className="w-4 h-4 text-primary flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-headline font-black text-on-surface uppercase italic truncate">{row.wod_name}</p>
                  <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">
                    {row.wod_type} • {row.scaling === 'rx' ? 'RX' : 'Scaled'}{row.load_kg != null ? ` • ${row.load_kg}kg` : ''}
                  </p>
                </div>
                <span className="text-lg font-headline font-black text-primary italic flex-shrink-0">{row.result}</span>
              </div>
              {row.description && (
                <p className="text-xs text-on-surface-variant font-medium leading-relaxed whitespace-pre-wrap">{row.description}</p>
              )}
            </div>
          ) : (
            /* Postado, ainda não treinado: tocar no card já inicia o cronômetro com ele */
            <button
              key={row.id}
              onClick={() => onStartWod?.(row)}
              disabled={!onStartWod}
              className="bg-surface-container rounded-3xl p-5 border border-secondary/20 flex flex-col gap-3 text-left hover:border-secondary/40 transition-all disabled:cursor-default"
            >
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-black text-on-surface uppercase tracking-widest">Seu WOD</p>
                <span className="text-[10px] font-black text-secondary uppercase tracking-widest">⏳ falta treinar</span>
              </div>
              <div className="flex items-center gap-3">
                {isTimeBasedType(row.wod_type) ? <Timer className="w-4 h-4 text-primary flex-shrink-0" /> : <Hash className="w-4 h-4 text-primary flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-headline font-black text-on-surface uppercase italic truncate">{row.wod_name}</p>
                  <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">
                    {row.wod_type} • {row.scaling === 'rx' ? 'RX' : 'Scaled'}
                  </p>
                </div>
              </div>
              {row.description && (
                <p className="text-xs text-on-surface-variant font-medium leading-relaxed whitespace-pre-wrap">{row.description}</p>
              )}
              <span
                onClick={e => { e.stopPropagation(); openEditForm(row); }}
                role="button"
                tabIndex={0}
                className="self-start flex items-center gap-1.5 text-[10px] font-black text-on-surface-variant uppercase tracking-widest hover:text-primary transition-all"
              >
                <Pencil className="w-3 h-3" /> Editar
              </span>
              <p className="text-[9px] text-secondary font-bold uppercase tracking-widest italic opacity-90 text-center">
                Toque para treinar e entrar no ranking
              </p>
            </button>
          )
        ))}

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
            className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest hover:text-primary transition-all text-center"
          >
            Ou treinar sem postar (cronômetro livre)
          </button>
        ) : null}
      </div>

      {/* Placar agrupado por WOD — só entra quem já tem resultado */}
      <div className="flex flex-col gap-5">
        {loading ? (
          <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>
        ) : groups.length === 0 ? (
          <div className="bg-surface-container rounded-3xl p-8 flex flex-col items-center text-center gap-3 border border-outline-variant/10">
            <Trophy className="w-12 h-12 text-on-surface-variant/20" />
            <p className="text-on-surface-variant font-headline font-black uppercase italic">Placar vazio</p>
            <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest opacity-60">
              Seja o primeiro a treinar o WOD de hoje
            </p>
          </div>
        ) : (
          groups.map(group => (
            <div key={group.name} className="flex flex-col gap-2">
              <button
                onClick={() => setExpandedGroups(prev => ({ ...prev, [group.name]: !prev[group.name] }))}
                disabled={!group.description}
                className="flex items-center gap-2 text-left disabled:cursor-default"
              >
                {group.timeBased ? <Timer className="w-4 h-4 text-primary flex-shrink-0" /> : <Hash className="w-4 h-4 text-primary flex-shrink-0" />}
                <h3 className="font-headline font-black text-sm text-on-surface uppercase italic tracking-widest">{group.name}</h3>
                <span className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest">
                  • {group.ranked.length} {group.ranked.length === 1 ? 'atleta' : 'atletas'}
                </span>
                {group.description && (
                  <ChevronDown className={cn('w-3.5 h-3.5 text-on-surface-variant transition-transform flex-shrink-0 ml-auto',
                    expandedGroups[group.name] && 'rotate-180')} />
                )}
              </button>
              {group.description && expandedGroups[group.name] && (
                <p className="text-xs text-on-surface-variant font-medium leading-relaxed whitespace-pre-wrap bg-surface-container-highest/40 rounded-2xl px-4 py-3">
                  {group.description}
                </p>
              )}
              {group.ranked.map((r, i) => {
                const isMe = r.user_id === user?.id;
                return (
                  <motion.div key={r.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                    className={cn('p-3 rounded-2xl border flex items-center justify-between transition-all',
                      isMe ? 'bg-primary/10 border-primary/30' : 'bg-surface-container border-outline-variant/10')}>
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-7 text-center font-headline font-black text-sm italic text-on-surface-variant">
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                      </span>
                      <Avatar r={r} className="w-10 h-10" />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-on-surface uppercase italic truncate">
                          {r.name}{isMe && ' (você)'}
                        </p>
                        <span className={cn('inline-block text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full mt-0.5 border',
                          r.scaling === 'rx' ? 'bg-primary/15 text-primary border-primary/30' : 'bg-secondary/15 text-secondary border-secondary/30')}>
                          {r.scaling === 'rx' ? 'RX' : 'Scaled'} • Nv {r.level}
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <span className="text-base font-headline font-black text-primary italic block">{r.result}</span>
                      {r.load_kg != null && (
                        <span className="text-[9px] font-bold text-on-surface-variant">{r.load_kg}kg</span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
