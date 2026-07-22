import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  Plus,
  X,
  Check,
  Flame,
  Dumbbell,
  Timer,
  StickyNote,
  Trash2,
  Copy,
  Swords,
  Search,
  Share2,
  Building2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { useToast } from '../context/ToastContext';
import { addReward, getRewardSettings, checkAndPayWeeklyBonus } from '../utils/rewards';
import { createNotification } from '../hooks/useNotifications';
import { TrainingLog, TrainingLogCategory, TrainingFeeling } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const todayBR = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

const FEELINGS: { value: TrainingFeeling; label: string; emoji: string }[] = [
  { value: 'otimo',   label: 'Ótimo',   emoji: '🔥' },
  { value: 'bem',     label: 'Bem',     emoji: '🙂' },
  { value: 'normal',  label: 'Normal',  emoji: '😐' },
  { value: 'cansado', label: 'Cansado', emoji: '🥱' },
  { value: 'dor',     label: 'Dor',     emoji: '🤕' },
];

const CATEGORIES: { value: TrainingLogCategory; label: string; icon: typeof Timer }[] = [
  { value: 'wod',     label: 'WOD',     icon: Timer },
  { value: 'forca',   label: 'Força',   icon: Dumbbell },
  { value: 'desafio', label: 'Desafio', icon: Flame },
  { value: 'nota',    label: 'Nota',    icon: StickyNote },
];

const WOD_TYPES = ['FOR TIME', 'AMRAP', 'EMOM', 'TABATA', 'OUTRO'];

/** Streak: dias consecutivos com registro, terminando hoje ou ontem */
const calcStreak = (dates: string[]): number => {
  if (dates.length === 0) return 0;
  const unique = Array.from(new Set(dates)).sort().reverse();
  const today = todayBR();
  const yesterday = new Date(Date.now() - 86400000)
    .toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  if (unique[0] !== today && unique[0] !== yesterday) return 0;

  let streak = 1;
  for (let i = 1; i < unique.length; i++) {
    const prev = new Date(unique[i - 1] + 'T00:00:00').getTime();
    const curr = new Date(unique[i] + 'T00:00:00').getTime();
    if (prev - curr === 86400000) streak++;
    else break;
  }
  return streak;
};

/** Extrai número de um valor de PR guardado como texto (ex: "100kg" → 100) */
const parseLoad = (value: string): number =>
  parseFloat(String(value).replace(',', '.').replace(/[^0-9.]/g, '')) || 0;

const normalizeFriendCode = (raw: string): string => {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length !== 8) return raw.toUpperCase().trim();
  return `${clean.slice(0, 4)}-${clean.slice(4)}`;
};

interface FriendProfile {
  id: string;
  name: string;
  level: number;
  xp: number;
  friend_code: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Diario() {
  const { user, updateUser } = useAuth();
  const toast = useToast();

  const [logs, setLogs] = useState<TrainingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Formulário
  const [category, setCategory] = useState<TrainingLogCategory>('wod');
  const [title, setTitle] = useState('');
  const [wodType, setWodType] = useState('FOR TIME');
  const [description, setDescription] = useState('');
  const [result, setResult] = useState('');
  const [exercise, setExercise] = useState('');
  const [loadKg, setLoadKg] = useState('');
  const [rpe, setRpe] = useState(0);
  const [feeling, setFeeling] = useState<TrainingFeeling | null>(null);
  const [notes, setNotes] = useState('');

  // Duelo por código de amigo
  const [codeInput, setCodeInput] = useState('');
  const [searchingFriend, setSearchingFriend] = useState(false);
  const [friend, setFriend] = useState<FriendProfile | null>(null);
  const [duelName, setDuelName] = useState('');
  const [duelType, setDuelType] = useState<'FOR TIME' | 'AMRAP' | 'EMOM'>('FOR TIME');
  const [duelDesc, setDuelDesc] = useState('');
  const [creatingDuel, setCreatingDuel] = useState(false);

  // Pedido de entrada no box (só para conta individual)
  const [joinRequest, setJoinRequest] = useState<{ id: string; status: string } | null>(null);
  const [sendingJoin, setSendingJoin] = useState(false);

  // ─── Load ────────────────────────────────────────────────────────────────

  const loadLogs = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('training_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(120);
      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error('Error loading training logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (user) loadLogs(); }, [user]);

  useEffect(() => {
    if (!user || user.accountType !== 'individual') return;
    supabase
      .from('box_join_requests')
      .select('id, status')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => { if (data) setJoinRequest(data); });
  }, [user]);

  const handleJoinBox = async () => {
    if (!user) return;
    setSendingJoin(true);
    try {
      const { data, error } = await supabase
        .from('box_join_requests')
        .insert({ user_id: user.id })
        .select('id, status')
        .single();
      if (error) throw error;
      setJoinRequest(data);
      toast.success('Pedido enviado! O admin do box vai analisar. 🤝');
    } catch (err: any) {
      console.error('Error requesting box join:', err);
      toast.error('Erro ao enviar pedido: ' + err.message);
    } finally {
      setSendingJoin(false);
    }
  };

  // ─── Derived ─────────────────────────────────────────────────────────────

  const streak = useMemo(() => {
    const dates = [
      ...logs.map(l => l.date),
      ...(user?.checkins || []).map(c => c.date),
    ];
    return calcStreak(dates);
  }, [logs, user?.checkins]);

  const loggedToday = logs.some(l => l.date === todayBR());
  const checkedInToday = (user?.checkins || []).some(c => c.date === todayBR());

  const logsByDate = useMemo(() => {
    const groups: Record<string, TrainingLog[]> = {};
    logs.forEach(l => { (groups[l.date] ||= []).push(l); });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [logs]);

  // ─── Recompensas ─────────────────────────────────────────────────────────

  const refreshBalances = async () => {
    if (!user) return;
    const [{ data: profile }, { data: checkins }] = await Promise.all([
      supabase.from('profiles').select('xp, coins, level').eq('id', user.id).maybeSingle(),
      supabase.from('checkins').select('*').eq('user_id', user.id),
    ]);
    if (profile) {
      updateUser({
        ...user,
        xp: profile.xp || 0,
        coins: profile.coins || 0,
        level: profile.level || 1,
        checkins: (checkins || []).map((c: any) => ({
          date: c.date, timestamp: c.timestamp, classTime: c.class_time,
        })),
      });
    }
  };

  /** Primeiro registro do dia = check-in solo automático + pontos */
  const soloCheckin = async () => {
    if (!user || checkedInToday) return;
    const { error } = await supabase.from('checkins').insert({
      user_id: user.id, date: todayBR(), class_time: 'SOLO',
    });
    // 23505 = já fez check-in hoje (constraint unique) — segue sem premiar de novo
    if (error) {
      if (error.code !== '23505') console.error('Solo check-in error:', error);
      return;
    }
    const rewards = await getRewardSettings();
    const xp = rewards?.xp_per_checkin ?? 20;
    const coins = rewards?.coins_per_checkin ?? 5;
    await addReward(user.id, 'checkin', xp, coins, 'Check-in solo — Diário de Treino');
    const weekly = await checkAndPayWeeklyBonus(user.id);
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors: ['#CAFD00', '#ffffff'] });
    toast.success(
      weekly?.paid
        ? `✅ Check-in solo! +${xp} XP, +${coins} coins — e bônus semanal de ${weekly.count} treinos: +${weekly.xp} XP, +${weekly.coins} coins!`
        : `✅ Check-in solo! +${xp} XP, +${coins} coins`
    );
  };

  /** Categoria Força: detecta e registra novo PR automaticamente */
  const detectPr = async (): Promise<boolean> => {
    if (!user || !exercise.trim() || !loadKg) return false;
    const load = parseFloat(loadKg.replace(',', '.'));
    if (!load || load <= 0) return false;

    const { data: existing } = await supabase
      .from('personal_records')
      .select('id, value')
      .eq('user_id', user.id)
      .ilike('exercise', exercise.trim());

    const best = (existing || []).reduce((max, pr) => Math.max(max, parseLoad(pr.value)), 0);
    if (load <= best) return false;

    await supabase.from('personal_records').insert({
      user_id: user.id,
      exercise: exercise.trim(),
      value: `${load}kg`,
      date: todayBR(),
    });
    await addReward(user.id, 'pr', 30, 10, `Novo PR: ${exercise.trim()} — ${load}kg`);
    confetti({ particleCount: 200, spread: 100, origin: { y: 0.5 }, colors: ['#CAFD00', '#FF7439', '#ffffff'] });
    toast.success(`🏆 NOVO PR! ${exercise.trim()} ${load}kg — +30 XP, +10 coins`);
    return true;
  };

  // ─── Salvar registro ─────────────────────────────────────────────────────

  const resetForm = () => {
    setTitle(''); setDescription(''); setResult('');
    setExercise(''); setLoadKg(''); setRpe(0);
    setFeeling(null); setNotes(''); setWodType('FOR TIME');
  };

  const handleSave = async () => {
    if (!user) return;
    if (category === 'forca') {
      if (!exercise.trim()) { toast.warning('Informe o exercício.'); return; }
    } else if (!title.trim()) {
      toast.warning('Dê um nome ao registro.'); return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('training_logs').insert({
        user_id: user.id,
        date: todayBR(),
        title: category === 'forca' ? (title.trim() || exercise.trim()) : title.trim(),
        category,
        wod_type: category === 'wod' ? wodType : null,
        description: description.trim() || null,
        result: result.trim() || null,
        exercise: category === 'forca' ? exercise.trim() : null,
        load_kg: category === 'forca' && loadKg ? parseFloat(loadKg.replace(',', '.')) : null,
        rpe: rpe > 0 ? rpe : null,
        feeling,
        notes: notes.trim() || null,
      });
      if (error) throw error;

      if (category === 'forca') await detectPr();
      // Nota solta não vale check-in — treino registrado sim
      if (category !== 'nota') await soloCheckin();
      await refreshBalances();

      resetForm();
      setShowForm(false);
      await loadLogs();
      toast.success('Registro salvo no seu diário! 📓');
    } catch (err: any) {
      console.error('Error saving training log:', err);
      toast.error('Erro ao salvar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (log: TrainingLog) => {
    try {
      const { error } = await supabase.from('training_logs').delete().eq('id', log.id);
      if (error) throw error;
      setLogs(prev => prev.filter(l => l.id !== log.id));
      toast.success('Registro removido.');
    } catch (err: any) {
      toast.error('Erro ao remover: ' + err.message);
    }
  };

  // ─── Duelo por código de amigo ───────────────────────────────────────────

  const handleCopyCode = async () => {
    if (!user?.friendCode) return;
    try {
      await navigator.clipboard.writeText(user.friendCode);
      toast.success('Código copiado!');
    } catch {
      toast.warning(`Seu código: ${user.friendCode}`);
    }
  };

  const handleShareCode = () => {
    if (!user?.friendCode) return;
    const text = `⚔️ Me desafie para um duelo no BoxLink! Meu código de atleta: ${user.friendCode} — ${window.location.origin}`;
    if (navigator.share) navigator.share({ title: 'BoxLink — Duelo', text }).catch(() => {});
    else handleCopyCode();
  };

  const handleFindFriend = async () => {
    if (!user || !codeInput.trim()) return;
    const code = normalizeFriendCode(codeInput);
    if (code === user.friendCode) {
      toast.warning('Esse é o seu próprio código! Chame um colega. 😄'); return;
    }
    setSearchingFriend(true);
    setFriend(null);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, level, xp, friend_code')
        .eq('friend_code', code)
        .maybeSingle();
      if (error) throw error;
      if (!data) { toast.error('Nenhum atleta encontrado com esse código.'); return; }
      setFriend(data as FriendProfile);
    } catch (err: any) {
      console.error('Error finding friend:', err);
      toast.error('Erro ao buscar atleta.');
    } finally {
      setSearchingFriend(false);
    }
  };

  const handleCreateDuel = async () => {
    if (!user || !friend) return;
    if (!duelName.trim() || !duelDesc.trim()) {
      toast.warning('Preencha nome e descrição do desafio.'); return;
    }
    setCreatingDuel(true);
    try {
      const { error } = await supabase.from('duels').insert({
        challenger_id: user.id,
        opponent_ids: [friend.id],
        accepted_by: [],
        status: 'pending',
        bet_amount: 0,
        bet_type: 'xp',
        bet_reserved: false,
        wod_id: null,
        wod_name: duelName.trim(),
        wod_type: duelType,
        wod_rx: duelDesc.trim(),
        wod_custom: true,
        category: 'RX',
        results: { [user.id]: null, [friend.id]: null },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;

      await createNotification(
        friend.id,
        'duel_created',
        '⚔️ Novo Duelo!',
        `${user.name || 'Um atleta'} te desafiou para um duelo — ${duelName.trim()}`,
        { challengerId: user.id, wodName: duelName.trim() }
      );

      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#CAFD00', '#ffffff'] });
      toast.success(`Duelo enviado para ${friend.name}! Acompanhe na aba Duelos. ⚔️`);
      setFriend(null); setCodeInput(''); setDuelName(''); setDuelDesc('');
    } catch (err: any) {
      console.error('Error creating friend duel:', err);
      toast.error('Erro ao criar duelo: ' + err.message);
    } finally {
      setCreatingDuel(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background pb-32">

      {/* Header */}
      <header className="p-6 pt-12 flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-headline font-black italic text-on-surface uppercase tracking-tight">
              Diário
            </h1>
            <p className="text-on-surface-variant text-xs font-medium uppercase tracking-widest opacity-60">
              Seu treino, suas regras
            </p>
          </div>
          <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-primary" />
          </div>
        </div>

        {/* Streak + status do dia */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-surface-container rounded-3xl p-4 border border-outline-variant/10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-secondary/10 flex items-center justify-center">
              <Flame className={cn('w-5 h-5', streak > 0 ? 'text-secondary' : 'text-on-surface-variant/40')} />
            </div>
            <div>
              <p className="text-xl font-headline font-black text-on-surface italic leading-none">{streak}</p>
              <p className="text-[9px] text-on-surface-variant font-black uppercase tracking-widest">
                {streak === 1 ? 'Dia seguido' : 'Dias seguidos'}
              </p>
            </div>
          </div>
          <div className="bg-surface-container rounded-3xl p-4 border border-outline-variant/10 flex items-center gap-3">
            <div className={cn(
              'w-10 h-10 rounded-2xl flex items-center justify-center',
              loggedToday || checkedInToday ? 'bg-primary/10' : 'bg-surface-container-highest'
            )}>
              <Check className={cn('w-5 h-5', loggedToday || checkedInToday ? 'text-primary' : 'text-on-surface-variant/40')} />
            </div>
            <div>
              <p className="text-xs font-headline font-black text-on-surface italic uppercase leading-tight">
                {loggedToday || checkedInToday ? 'Treino feito' : 'Sem treino'}
              </p>
              <p className="text-[9px] text-on-surface-variant font-black uppercase tracking-widest">Hoje</p>
            </div>
          </div>
        </div>
        {!checkedInToday && (
          <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest text-center italic opacity-70">
            Registre seu primeiro treino do dia e ganhe o check-in solo + pontos
          </p>
        )}
      </header>

      {/* ── Formulário de registro ── */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mx-6 mb-4 bg-surface-container rounded-3xl border border-outline-variant/10 p-6 flex flex-col gap-5"
          >
            <div className="flex justify-between items-center">
              <h2 className="font-headline font-black text-lg text-on-surface uppercase italic">Novo Registro</h2>
              <button onClick={() => setShowForm(false)}>
                <X className="w-5 h-5 text-on-surface-variant" />
              </button>
            </div>

            {/* Categoria */}
            <div className="grid grid-cols-4 gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  onClick={() => setCategory(cat.value)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 py-3 rounded-2xl border transition-all',
                    category === cat.value
                      ? 'bg-primary/10 border-primary/40 text-primary'
                      : 'bg-surface-container-highest border-transparent text-on-surface-variant'
                  )}
                >
                  <cat.icon className="w-4 h-4" />
                  <span className="text-[9px] font-black uppercase tracking-widest">{cat.label}</span>
                </button>
              ))}
            </div>

            {/* Campos por categoria */}
            {category === 'forca' ? (
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  placeholder="Exercício (ex: Back Squat)"
                  value={exercise}
                  onChange={e => setExercise(e.target.value)}
                  className="w-full bg-surface-container-highest rounded-2xl px-4 py-3 text-sm font-medium text-on-surface outline-none"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Carga (kg)"
                    value={loadKg}
                    onChange={e => setLoadKg(e.target.value)}
                    className="flex-1 bg-surface-container-highest rounded-2xl px-4 py-3 text-sm font-medium text-on-surface outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Reps (ex: 1RM, 3x5)"
                    value={result}
                    onChange={e => setResult(e.target.value)}
                    className="flex-1 bg-surface-container-highest rounded-2xl px-4 py-3 text-sm font-medium text-on-surface outline-none"
                  />
                </div>
                <p className="text-[9px] text-on-surface-variant font-bold uppercase tracking-widest italic opacity-70">
                  Se a carga superar seu recorde, o PR é registrado automaticamente 🏆
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  placeholder={category === 'nota' ? 'Título da nota' : 'Nome do treino (ex: Murph, WOD do dia)'}
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full bg-surface-container-highest rounded-2xl px-4 py-3 text-sm font-medium text-on-surface outline-none"
                />
                {category === 'wod' && (
                  <div className="flex gap-2">
                    <select
                      value={wodType}
                      onChange={e => setWodType(e.target.value)}
                      className="flex-1 bg-surface-container-highest rounded-2xl px-4 py-3 text-sm font-medium text-on-surface outline-none"
                    >
                      {WOD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <input
                      type="text"
                      placeholder="Resultado (12:45 ou 150 reps)"
                      value={result}
                      onChange={e => setResult(e.target.value)}
                      className="flex-1 bg-surface-container-highest rounded-2xl px-4 py-3 text-sm font-medium text-on-surface outline-none"
                    />
                  </div>
                )}
                {category === 'desafio' && (
                  <input
                    type="text"
                    placeholder="Resultado (ex: 100 burpees em 8:30)"
                    value={result}
                    onChange={e => setResult(e.target.value)}
                    className="w-full bg-surface-container-highest rounded-2xl px-4 py-3 text-sm font-medium text-on-surface outline-none"
                  />
                )}
                {category !== 'nota' && (
                  <textarea
                    placeholder="Movimentos / descrição"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={3}
                    className="w-full bg-surface-container-highest rounded-2xl px-4 py-3 text-sm font-medium text-on-surface outline-none resize-none"
                  />
                )}
              </div>
            )}

            {/* RPE */}
            {category !== 'nota' && (
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">
                  Esforço percebido (RPE) {rpe > 0 ? `— ${rpe}/10` : ''}
                </label>
                <div className="flex gap-1">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                    <button
                      key={n}
                      onClick={() => setRpe(n === rpe ? 0 : n)}
                      className={cn(
                        'flex-1 py-2 rounded-lg text-[10px] font-black transition-all',
                        n <= rpe ? 'bg-primary text-background' : 'bg-surface-container-highest text-on-surface-variant'
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Como se sentiu */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Como você está?</label>
              <div className="flex gap-2">
                {FEELINGS.map(f => (
                  <button
                    key={f.value}
                    onClick={() => setFeeling(feeling === f.value ? null : f.value)}
                    className={cn(
                      'flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border transition-all',
                      feeling === f.value
                        ? 'bg-primary/10 border-primary/40'
                        : 'bg-surface-container-highest border-transparent'
                    )}
                  >
                    <span className="text-base leading-none">{f.emoji}</span>
                    <span className={cn(
                      'text-[8px] font-black uppercase tracking-wider',
                      feeling === f.value ? 'text-primary' : 'text-on-surface-variant'
                    )}>
                      {f.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Anotações */}
            <textarea
              placeholder="Anotações (sono, dieta, dores, observações...)"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full bg-surface-container-highest rounded-2xl px-4 py-3 text-sm font-medium text-on-surface outline-none resize-none"
            />

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-primary text-background py-4 rounded-2xl font-headline font-black text-sm uppercase italic shadow-lg flex items-center justify-center gap-2 disabled:opacity-40 hover:opacity-90 transition-all"
            >
              {saving
                ? <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin" />
                : <Check className="w-5 h-5" />}
              SALVAR NO DIÁRIO
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Duelo por código de amigo ── */}
      <section className="mx-6 mb-6 bg-surface-container rounded-3xl border border-outline-variant/10 p-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-secondary/10 flex items-center justify-center">
            <Swords className="w-5 h-5 text-secondary" />
          </div>
          <div>
            <h2 className="font-headline font-black text-base text-on-surface uppercase italic leading-tight">Duelo com Amigos</h2>
            <p className="text-[9px] text-on-surface-variant font-bold uppercase tracking-widest">Desafie quem tem o app, de qualquer lugar</p>
          </div>
        </div>

        {/* Meu código */}
        <div className="bg-surface-container-highest/50 rounded-2xl p-4 flex items-center justify-between border border-outline-variant/10">
          <div>
            <p className="text-[9px] text-on-surface-variant font-black uppercase tracking-widest mb-0.5">Meu código de atleta</p>
            <p className="text-lg font-headline font-black text-primary italic tracking-wider">
              {user?.friendCode || '— — — —'}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCopyCode}
              className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-primary transition-all"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={handleShareCode}
              className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-primary transition-all"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Buscar amigo */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50" />
            <input
              type="text"
              placeholder="Código do amigo (ex: AB2C-3DEF)"
              value={codeInput}
              onChange={e => setCodeInput(e.target.value.toUpperCase())}
              className="w-full bg-surface-container-highest rounded-2xl pl-9 pr-4 py-3 text-sm font-bold text-on-surface placeholder:text-on-surface-variant/40 outline-none tracking-wider"
            />
          </div>
          <button
            onClick={handleFindFriend}
            disabled={searchingFriend || !codeInput.trim()}
            className="bg-secondary text-background px-5 rounded-2xl font-headline font-black text-xs uppercase italic disabled:opacity-40 hover:opacity-90 transition-all"
          >
            {searchingFriend
              ? <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin" />
              : 'Buscar'}
          </button>
        </div>

        {/* Amigo encontrado → montar duelo */}
        <AnimatePresence>
          {friend && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-col gap-3 overflow-hidden"
            >
              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center font-headline font-black text-on-surface">
                  {friend.name[0]}
                </div>
                <div>
                  <p className="text-sm font-bold text-on-surface uppercase italic">{friend.name}</p>
                  <p className="text-[10px] text-on-surface-variant font-bold">Nível {friend.level} • {friend.xp} XP</p>
                </div>
                <button onClick={() => setFriend(null)} className="ml-auto">
                  <X className="w-4 h-4 text-on-surface-variant" />
                </button>
              </div>

              <input
                type="text"
                placeholder="Nome do desafio (ex: 100 Burpees)"
                value={duelName}
                onChange={e => setDuelName(e.target.value)}
                className="w-full bg-surface-container-highest rounded-2xl px-4 py-3 text-sm font-medium text-on-surface outline-none"
              />
              <select
                value={duelType}
                onChange={e => setDuelType(e.target.value as any)}
                className="w-full bg-surface-container-highest rounded-2xl px-4 py-3 text-sm font-medium text-on-surface outline-none"
              >
                <option value="FOR TIME">For Time — menor tempo vence</option>
                <option value="AMRAP">AMRAP — mais reps vence</option>
                <option value="EMOM">EMOM</option>
              </select>
              <textarea
                placeholder="Descrição / movimentos do desafio"
                value={duelDesc}
                onChange={e => setDuelDesc(e.target.value)}
                rows={2}
                className="w-full bg-surface-container-highest rounded-2xl px-4 py-3 text-sm font-medium text-on-surface outline-none resize-none"
              />
              <button
                onClick={handleCreateDuel}
                disabled={creatingDuel || !duelName.trim() || !duelDesc.trim()}
                className="w-full bg-secondary text-background py-4 rounded-2xl font-headline font-black text-sm uppercase italic shadow-lg flex items-center justify-center gap-2 disabled:opacity-40 hover:opacity-90 transition-all"
              >
                {creatingDuel
                  ? <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin" />
                  : <Swords className="w-5 h-5" />}
                ENVIAR DESAFIO
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ── Quero entrar no Box (só conta individual) ── */}
      {user?.accountType === 'individual' && (
        <section className="mx-6 mb-6 bg-surface-container rounded-3xl border border-outline-variant/10 p-6 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-headline font-black text-base text-on-surface uppercase italic leading-tight">Entrar no Box</h2>
              <p className="text-[9px] text-on-surface-variant font-bold uppercase tracking-widest">
                Vire aluno mantendo pontos, PRs e diário
              </p>
            </div>
          </div>

          {joinRequest?.status === 'pending' ? (
            <div className="bg-secondary/10 border border-secondary/20 rounded-2xl p-4 text-center">
              <p className="text-xs font-black text-secondary uppercase tracking-widest italic">
                ⏳ Pedido enviado — aguardando o admin do box
              </p>
            </div>
          ) : joinRequest?.status === 'approved' ? (
            <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 text-center">
              <p className="text-xs font-black text-primary uppercase tracking-widest italic">
                🎉 Aprovado! Saia e entre de novo para ativar o modo Box
              </p>
            </div>
          ) : (
            <>
              {joinRequest?.status === 'rejected' && (
                <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest text-center italic opacity-70">
                  Seu último pedido foi recusado — você pode tentar novamente
                </p>
              )}
              <button
                onClick={handleJoinBox}
                disabled={sendingJoin}
                className="w-full bg-surface-container-highest text-on-surface py-4 rounded-2xl font-headline font-black text-sm uppercase italic border border-outline-variant/10 flex items-center justify-center gap-2 disabled:opacity-40 hover:border-primary/40 transition-all"
              >
                {sendingJoin
                  ? <div className="w-4 h-4 border-2 border-on-surface border-t-transparent rounded-full animate-spin" />
                  : <Building2 className="w-5 h-5" />}
                QUERO ENTRAR NO BOX
              </button>
            </>
          )}
        </section>
      )}

      {/* ── Histórico ── */}
      <main className="px-6 flex flex-col gap-5">
        <h2 className="font-headline font-black text-sm text-on-surface-variant uppercase italic tracking-widest">Histórico</h2>

        {loading && !logs.length ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="bg-surface-container rounded-3xl p-12 flex flex-col items-center text-center gap-4 border border-outline-variant/10">
            <BookOpen className="w-16 h-16 text-on-surface-variant/20 mb-2" />
            <p className="text-on-surface-variant font-headline font-black uppercase italic">Seu diário está vazio</p>
            <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest opacity-60">
              Registre seu primeiro treino no botão +
            </p>
          </div>
        ) : (
          logsByDate.map(([date, dayLogs]) => (
            <div key={date} className="flex flex-col gap-2">
              <p className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest">
                {date === todayBR()
                  ? 'Hoje'
                  : new Date(date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
              </p>
              {dayLogs.map(log => {
                const CatIcon = CATEGORIES.find(c => c.value === log.category)?.icon || Timer;
                const feelingInfo = FEELINGS.find(f => f.value === log.feeling);
                return (
                  <div key={log.id} className="bg-surface-container rounded-3xl p-4 border border-outline-variant/10 flex flex-col gap-2">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <CatIcon className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-headline font-black text-on-surface uppercase italic truncate">
                          {log.title}
                        </p>
                        <p className="text-[9px] text-on-surface-variant font-bold uppercase tracking-widest">
                          {log.category === 'forca'
                            ? `${log.exercise}${log.load_kg ? ` • ${log.load_kg}kg` : ''}${log.result ? ` • ${log.result}` : ''}`
                            : [log.wod_type, log.result].filter(Boolean).join(' • ') || 'Anotação'}
                          {log.rpe ? ` • RPE ${log.rpe}` : ''}
                          {feelingInfo ? ` ${feelingInfo.emoji}` : ''}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDelete(log)}
                        className="text-on-surface-variant/30 hover:text-error transition-all p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {(log.description || log.notes) && (
                      <p className="text-xs text-on-surface-variant font-medium leading-relaxed whitespace-pre-wrap pl-12">
                        {[log.description, log.notes].filter(Boolean).join('\n')}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </main>

      {/* FAB */}
      <button
        onClick={() => setShowForm(s => !s)}
        className="fixed bottom-28 right-6 w-14 h-14 bg-primary text-background rounded-2xl shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
      >
        {showForm ? <X className="w-6 h-6" strokeWidth={3} /> : <Plus className="w-6 h-6" strokeWidth={3} />}
      </button>
    </div>
  );
}
