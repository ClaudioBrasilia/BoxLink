import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  Plus,
  X,
  Check,
  Flame,
  Dumbbell,
  Timer,
  Play,
  StickyNote,
  Trash2,
  Copy,
  Swords,
  Search,
  Share2,
  Building2,
  Trophy,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { useToast } from '../context/ToastContext';
import { addReward, getRewardSettings, checkAndPayWeeklyBonus } from '../utils/rewards';
import { createNotification } from '../hooks/useNotifications';
import { TrainingLog, TrainingLogCategory, TrainingFeeling, AvatarSlot } from '../types';
import { isPremium, planLimits, PLAN_LIMITS } from '../lib/plan';
import WodTimer, { WodTimerResult, WodTimerType } from '../components/WodTimer';
import AvatarPreview from '../components/AvatarPreview';
import DailyWodPanel from '../components/DailyWodPanel';
import PremiumCTA from '../components/PremiumCTA';
import { postDailyWodResult, dailyWodDate } from '../lib/dailyWods';
import { useNavigate } from 'react-router-dom';

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
// Tipos que o cronômetro (WodTimer) sabe rodar — "OUTRO" não é um deles.
const TIMER_TYPES: WodTimerType[] = ['FOR TIME', 'AMRAP', 'EMOM', 'TABATA'];

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

export default function Diario() {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  // Alunos de box também acessam o Diário (registro pessoal de treino), mas o
  // Placar de WODs e o duelo por código de amigo são exclusivos do individual
  // — sem isso, um aluno de box poluiria o placar/duelo que é só da comunidade
  // individual.
  const isIndividual = user?.accountType === 'individual';

  const [logs, setLogs] = useState<TrainingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showTimer, setShowTimer] = useState(false);
  const [effortData, setEffortData] = useState<WodTimerResult['effort']>(null);

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
  const [postToPlacar, setPostToPlacar] = useState(true);
  const [placarScaling, setPlacarScaling] = useState<'rx' | 'scaled'>('rx');
  const [placarRefreshKey, setPlacarRefreshKey] = useState(0);
  // WOD do dia postado em "Poste seu WOD" (definição) — usado para "Iniciar
  // Meu WOD" já carregar o cronômetro com o que o atleta vai treinar.
  const [myPlacarWod, setMyPlacarWod] = useState<{
    wod_name: string; wod_type: string; description: string | null; result: string | null; scaling: 'rx' | 'scaled';
  } | null>(null);
  // Quando definido, o "Novo Registro" está em modo "adicionar detalhes" a um
  // treino que o cronômetro já salvou — o save vira UPDATE, não um INSERT novo.
  const [editingLogId, setEditingLogId] = useState<string | null>(null);

  const [codeInput, setCodeInput] = useState('');
  const [searchingFriend, setSearchingFriend] = useState(false);
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [duelName, setDuelName] = useState('');
  const [duelType, setDuelType] = useState<'FOR TIME' | 'AMRAP' | 'EMOM'>('FOR TIME');
  const [duelDesc, setDuelDesc] = useState('');
  const [creatingDuel, setCreatingDuel] = useState(false);

  const [joinRequest, setJoinRequest] = useState<{ id: string; status: string } | null>(null);
  const [sendingJoin, setSendingJoin] = useState(false);
  const [showBoxPicker, setShowBoxPicker] = useState(false);
  const [boxes, setBoxes] = useState<{ id: string; name: string; logo?: string | null }[]>([]);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const [loadingBoxes, setLoadingBoxes] = useState(false);

  const premium = isPremium(user);
  const maxDuelFriends = planLimits(user).maxDuelFriends;

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

  const loadMyPlacarWod = async () => {
    if (!user || !isIndividual) return;
    const { data } = await supabase
      .from('daily_wod_results')
      .select('wod_name, wod_type, description, result, scaling')
      .eq('user_id', user.id)
      .eq('wod_date', dailyWodDate())
      .maybeSingle();
    setMyPlacarWod(data ?? null);
  };

  useEffect(() => { if (user) loadMyPlacarWod(); }, [user]);

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

  // Boxes cadastrados (hoje só existe um, mas a tela já é um seletor,
  // preparada para quando houver mais).
  const loadBoxes = async () => {
    setLoadingBoxes(true);
    try {
      const { data } = await supabase.from('box_settings').select('id, name, logo');
      const list = data || [];
      setBoxes(list);
      if (list.length === 1) setSelectedBoxId(list[0].id);
    } catch (err) {
      console.error('Error loading boxes:', err);
    } finally {
      setLoadingBoxes(false);
    }
  };

  const openBoxPicker = () => {
    setShowBoxPicker(true);
    if (boxes.length === 0) loadBoxes();
  };

  const handleJoinBox = async () => {
    if (!user || !selectedBoxId) return;
    setSendingJoin(true);
    try {
      const { data, error } = await supabase
        .from('box_join_requests')
        .insert({ user_id: user.id, box_id: selectedBoxId })
        .select('id, status')
        .single();
      if (error) throw error;
      setJoinRequest(data);
      setShowBoxPicker(false);
      toast.success('Pedido enviado! O admin do box vai analisar. 🤝');
    } catch (err: any) {
      console.error('Error requesting box join:', err);
      toast.error('Erro ao enviar pedido: ' + err.message);
    } finally {
      setSendingJoin(false);
    }
  };

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

  // WOD já postado hoje mas ainda sem resultado — "Iniciar Meu WOD" carrega o
  // cronômetro com ele em vez de abrir em branco.
  const pendingPlacarWod = myPlacarWod && !myPlacarWod.result ? myPlacarWod : null;

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

  const soloCheckin = async () => {
    if (!user || checkedInToday) return;
    const { error } = await supabase.from('checkins').insert({
      user_id: user.id, date: todayBR(), class_time: 'SOLO',
    });
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

  const resetForm = () => {
    setTitle(''); setDescription(''); setResult('');
    setExercise(''); setLoadKg(''); setRpe(0);
    setFeeling(null); setNotes(''); setWodType('FOR TIME');
    setEffortData(null); setPostToPlacar(true); setPlacarScaling('rx');
    setEditingLogId(null);
  };

  const closeForm = () => { setShowForm(false); resetForm(); };
  const openBlankForm = () => { resetForm(); setShowForm(true); };

  const handleSave = async () => {
    if (!user) return;

    // Modo "detalhes do treino": o treino já foi salvo pelo cronômetro —
    // aqui atualiza a MESMA linha (nome/tipo/resultado, se ajustados, mais
    // RPE/sensação/notas) e sincroniza o placar, sem duplicar nada.
    if (editingLogId) {
      if (!title.trim()) { toast.warning('Dê um nome ao WOD.'); return; }
      setSaving(true);
      try {
        const { error } = await supabase.from('training_logs').update({
          title: title.trim(),
          wod_type: wodType,
          description: description.trim() || null,
          result: result.trim() || null,
          rpe: rpe > 0 ? rpe : null,
          feeling,
          notes: notes.trim() || null,
        }).eq('id', editingLogId);
        if (error) throw error;

        if (isIndividual && result.trim()) {
          try {
            await postDailyWodResult({
              userId: user.id, wodName: title.trim(), wodType, result: result.trim(),
              scaling: placarScaling, description: description.trim() || undefined,
            });
            setPlacarRefreshKey(k => k + 1);
            await loadMyPlacarWod();
          } catch (err) {
            console.error('Error syncing placar from details:', err);
          }
        }

        closeForm();
        await loadLogs();
        toast.success('Detalhes salvos! 📓');
      } catch (err: any) {
        console.error('Error updating training log:', err);
        toast.error('Erro ao salvar detalhes: ' + err.message);
      } finally {
        setSaving(false);
      }
      return;
    }

    if (category === 'forca') {
      if (!exercise.trim()) { toast.warning('Informe o exercício.'); return; }
    } else if (!title.trim()) {
      toast.warning('Dê um nome ao registro.'); return;
    }

    setSaving(true);
    try {
      const eff = category === 'wod' ? effortData : null;
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
        hr_avg: eff?.avgBpm ?? null,
        hr_max: eff?.maxBpm ?? null,
        hr_avg_pct: eff?.avgPctMax ?? null,
        effort_index: eff?.effortIndex ?? null,
        hr_zone: eff?.dominantZone ?? null,
      });
      if (error) throw error;

      if (category === 'forca') await detectPr();
      if (category !== 'nota') await soloCheckin();

      // Registra o RESULTADO no Placar de WODs sem reescrever: usa o mesmo
      // nome/tipo/resultado que acabou de ser salvo no diário. Se o WOD já
      // tinha sido postado (definição), esta chamada grava o resultado na
      // MESMA linha — não cria uma segunda entrada.
      if (isIndividual && category === 'wod' && postToPlacar && title.trim() && result.trim()) {
        try {
          const outcome = await postDailyWodResult({
            userId: user.id, wodName: title.trim(), wodType, result: result.trim(), scaling: placarScaling,
            description: description.trim() || undefined,
          });
          if (outcome.firstTime) {
            confetti({ particleCount: 140, spread: 80, origin: { y: 0.6 }, colors: ['#CAFD00', '#ffffff'] });
            toast.success(
              outcome.weeklyBonusPaid
                ? `WOD também no placar! +${outcome.xp} XP e bônus semanal 🔥`
                : `WOD também no placar! +${outcome.xp} XP`,
            );
          }
          setPlacarRefreshKey(k => k + 1);
          await loadMyPlacarWod();
        } catch (err: any) {
          console.error('Error posting placar from diário:', err);
          toast.error('Registro salvo, mas houve erro ao postar no placar.');
        }
      }

      await refreshBalances();

      closeForm();
      await loadLogs();
      toast.success('Registro salvo no seu diário! 📓');
    } catch (err: any) {
      console.error('Error saving training log:', err);
      toast.error('Erro ao salvar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // O cronômetro já salva o treino ao finalizar — o "Novo Registro" que abre
  // em seguida é só para ADICIONAR detalhes opcionais (RPE, sensação,
  // notas), nunca a única chance de gravar o resultado.
  const handleTimerFinish = async (data: WodTimerResult) => {
    if (!user) return;
    setShowTimer(false);
    setSaving(true);
    try {
      const eff = data.effort;
      const wodName = data.title.trim() || data.wodType;
      const wodResult = data.result.trim();
      const scaling = myPlacarWod?.scaling || 'rx';

      const { data: inserted, error } = await supabase.from('training_logs').insert({
        user_id: user.id,
        date: todayBR(),
        title: wodName,
        category: 'wod',
        wod_type: data.wodType,
        description: data.description.trim() || null,
        result: wodResult || null,
        hr_avg: eff?.avgBpm ?? null,
        hr_max: eff?.maxBpm ?? null,
        hr_avg_pct: eff?.avgPctMax ?? null,
        effort_index: eff?.effortIndex ?? null,
        hr_zone: eff?.dominantZone ?? null,
      }).select('id').single();
      if (error) throw error;

      await soloCheckin();

      let placarOutcome: Awaited<ReturnType<typeof postDailyWodResult>> | null = null;
      if (isIndividual && wodResult) {
        try {
          placarOutcome = await postDailyWodResult({
            userId: user.id, wodName, wodType: data.wodType, result: wodResult, scaling,
            description: data.description.trim() || undefined,
          });
          setPlacarRefreshKey(k => k + 1);
          await loadMyPlacarWod();
        } catch (err) {
          console.error('Error posting placar from timer:', err);
        }
      }

      await refreshBalances();
      await loadLogs();

      confetti({ particleCount: 160, spread: 90, origin: { y: 0.6 }, colors: ['#CAFD00', '#ffffff'] });
      toast.success(
        placarOutcome?.firstTime
          ? `Treino salvo! +${placarOutcome.xp} XP no placar 🔥`
          : 'Treino salvo no seu diário! 📓',
      );

      // Abre o formulário só para complementar (RPE/sensação/notas) — o
      // treino em si já está salvo, então fechar sem tocar em nada não perde nada.
      setEditingLogId(inserted?.id ?? null);
      setCategory('wod');
      setWodType(data.wodType);
      setTitle(data.title);
      setDescription(data.description);
      setResult(data.result);
      setEffortData(data.effort ?? null);
      setPlacarScaling(scaling);
      setShowForm(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error('Error saving timer result:', err);
      toast.error('Erro ao salvar treino: ' + err.message);
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
    if (friends.some(f => f.friend_code === code)) {
      toast.warning('Esse amigo já está na lista.'); return;
    }
    if (friends.length >= maxDuelFriends) {
      toast.warning(premium
        ? `Limite de ${maxDuelFriends} amigos por duelo.`
        : `No plano grátis você chama 1 amigo por duelo. Premium: até ${PLAN_LIMITS.premium.maxDuelFriends}.`);
      return;
    }
    setSearchingFriend(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, level, xp, friend_code')
        .eq('friend_code', code)
        .maybeSingle();
      if (error) throw error;
      if (!data) { toast.error('Nenhum atleta encontrado com esse código.'); return; }
      if (friends.some(f => f.id === data.id)) { toast.warning('Esse amigo já está na lista.'); return; }
      setFriends(prev => [...prev, data as FriendProfile]);
      setCodeInput('');
    } catch (err: any) {
      console.error('Error finding friend:', err);
      toast.error('Erro ao buscar atleta.');
    } finally {
      setSearchingFriend(false);
    }
  };

  const removeFriend = (id: string) => setFriends(prev => prev.filter(f => f.id !== id));

  const handleCreateDuel = async () => {
    if (!user || friends.length === 0) return;
    if (!duelName.trim() || !duelDesc.trim()) {
      toast.warning('Preencha nome e descrição do desafio.'); return;
    }
    setCreatingDuel(true);
    try {
      const opponentIds = friends.map(f => f.id);
      const results: Record<string, null> = { [user.id]: null };
      opponentIds.forEach(id => { results[id] = null; });

      const { error } = await supabase.from('duels').insert({
        challenger_id: user.id,
        opponent_ids: opponentIds,
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
        results,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;

      for (const f of friends) {
        await createNotification(
          f.id,
          'duel_created',
          '⚔️ Novo Duelo!',
          `${user.name || 'Um atleta'} te desafiou para um duelo — ${duelName.trim()}`,
          { challengerId: user.id, wodName: duelName.trim() }
        );
      }

      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#CAFD00', '#ffffff'] });
      toast.success(friends.length === 1
        ? `Duelo enviado para ${friends[0].name}! Acompanhe na aba Duelos. ⚔️`
        : `Duelo enviado para ${friends.length} amigos! Acompanhe na aba Duelos. ⚔️`);
      setFriends([]); setCodeInput(''); setDuelName(''); setDuelDesc('');
    } catch (err: any) {
      console.error('Error creating friend duel:', err);
      toast.error('Erro ao criar duelo: ' + err.message);
    } finally {
      setCreatingDuel(false);
    }
  };

  // Blocos reaproveitados tanto no "Novo Registro" (manual) quanto em
  // "Detalhes do Treino" (após o cronômetro) — mesmo estado, duas telas.
  const rpeSection = category !== 'nota' && (
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
  );

  const feelingSection = (
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
  );

  const notesSection = (
    <textarea
      placeholder="Anotações (sono, dieta, dores, observações...)"
      value={notes}
      onChange={e => setNotes(e.target.value)}
      rows={2}
      className="w-full bg-surface-container-highest rounded-2xl px-4 py-3 text-sm font-medium text-on-surface outline-none resize-none"
    />
  );

  return (
    <div className="min-h-screen bg-background pb-32">

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
          <button
            onClick={() => navigate('/avatar')}
            className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 overflow-hidden flex items-center justify-center hover:border-primary/50 active:scale-95 transition-all"
            aria-label="Personalizar avatar"
          >
            <AvatarPreview
              equipped={(user?.avatar?.equipped || {}) as AvatarSlot}
              size="sm"
              className="w-full h-full border-none shadow-none"
            />
          </button>
        </div>

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

      <button
        onClick={() => setShowTimer(true)}
        className="mx-6 mb-4 bg-gradient-to-r from-primary/15 to-secondary/10 border border-primary/25 rounded-3xl p-5 flex items-center gap-4 hover:border-primary/50 transition-all text-left w-[calc(100%-3rem)]"
      >
        <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center flex-shrink-0">
          <Timer className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1">
          <p className="font-headline font-black text-base text-on-surface uppercase italic leading-tight">Iniciar Meu WOD</p>
          <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">
            {pendingPlacarWod
              ? `${pendingPlacarWod.wod_name} • ${pendingPlacarWod.wod_type}`
              : 'Cronômetro For Time · AMRAP · EMOM · Tabata'}
          </p>
        </div>
        <Play className="w-5 h-5 text-primary flex-shrink-0" />
      </button>

      {/* Placar de WODs é a comunidade do individual — atleta de box já tem
          Feed/Ranking/WOD do dia próprios do box, não deve poluir nem ver este. */}
      {isIndividual && (
        <DailyWodPanel
          onChange={loadMyPlacarWod}
          refreshSignal={placarRefreshKey}
        />
      )}

      <AnimatePresence>
        {showForm && editingLogId && (
          /* Tela cheia — sempre visível assim que o cronômetro termina, sem
             depender de scroll nem do tamanho do placar acima. */
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[65] bg-background flex flex-col"
          >
            <div className="flex items-center justify-between p-6 pt-12">
              <h2 className="font-headline font-black text-lg text-on-surface uppercase italic">Detalhes do Treino</h2>
              <button onClick={closeForm} className="w-9 h-9 rounded-full bg-surface-container-highest flex items-center justify-center">
                <X className="w-5 h-5 text-on-surface-variant" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-8 flex flex-col gap-5">
              <div className="bg-primary/10 border border-primary/20 rounded-2xl px-4 py-3 flex items-center gap-2">
                <Check className="w-4 h-4 text-primary flex-shrink-0" />
                <p className="text-[11px] text-on-surface font-bold leading-snug">
                  Treino salvo! Confira o resultado e complete os detalhes se quiser.
                </p>
              </div>

              <input
                type="text"
                placeholder="Nome do WOD"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full bg-surface-container-highest rounded-2xl px-4 py-3 text-sm font-bold text-on-surface outline-none"
              />
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
                  className="flex-1 bg-surface-container-highest rounded-2xl px-4 py-3 text-sm font-bold text-on-surface outline-none"
                />
              </div>
              <textarea
                placeholder="Movimentos / descrição"
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={2}
                className="w-full bg-surface-container-highest rounded-2xl px-4 py-3 text-sm font-medium text-on-surface outline-none resize-none"
              />

              {rpeSection}
              {feelingSection}
              {notesSection}

              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-primary text-background py-4 rounded-2xl font-headline font-black text-sm uppercase italic shadow-lg flex items-center justify-center gap-2 disabled:opacity-40 hover:opacity-90 transition-all"
              >
                {saving
                  ? <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin" />
                  : <Check className="w-5 h-5" />}
                SALVAR DETALHES
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showForm && !editingLogId && (
          /* Tela cheia — mesma razão do "Detalhes do Treino": um card no meio
             do fluxo da página, abaixo do Placar, ficava fora da vista. */
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[65] bg-background flex flex-col"
          >
            <div className="flex items-center justify-between p-6 pt-12">
              <h2 className="font-headline font-black text-lg text-on-surface uppercase italic">Novo Registro</h2>
              <button onClick={closeForm} className="w-9 h-9 rounded-full bg-surface-container-highest flex items-center justify-center">
                <X className="w-5 h-5 text-on-surface-variant" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-8 flex flex-col gap-5">

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
                {isIndividual && category === 'wod' && (
                  <div className="bg-surface-container-highest/50 rounded-2xl p-4 flex flex-col gap-3 border border-outline-variant/10">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-secondary" />
                        <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">
                          Registrar Resultado no Placar
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPostToPlacar(p => !p)}
                        className={cn(
                          'w-12 h-6 rounded-full transition-all relative',
                          postToPlacar ? 'bg-primary' : 'bg-outline-variant/30'
                        )}
                      >
                        <div className={cn(
                          'w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all shadow',
                          postToPlacar ? 'left-6' : 'left-0.5'
                        )} />
                      </button>
                    </div>
                    {postToPlacar && (
                      <div className="flex gap-2">
                        {(['rx', 'scaled'] as const).map(s => (
                          <button
                            type="button"
                            key={s}
                            onClick={() => setPlacarScaling(s)}
                            className={cn('flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
                              placarScaling === s
                                ? s === 'rx' ? 'bg-primary text-background' : 'bg-secondary text-background'
                                : 'bg-surface-container text-on-surface-variant')}
                          >
                            {s === 'rx' ? 'RX' : 'Scaled'}
                          </button>
                        ))}
                      </div>
                    )}
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

            {rpeSection}
            {feelingSection}
            {notesSection}

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
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Duelo por código é a forma do individual desafiar (sem roster de box).
          Box já cria duelo em Duelos (busca entre atletas do próprio box). */}
      {isIndividual && (
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

        {!premium && (
          <div className="flex flex-col gap-2">
            <div className="bg-secondary/5 border border-secondary/20 rounded-2xl px-4 py-3 flex items-center gap-2">
              <span className="text-sm">🔒</span>
              <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest leading-snug">
                <span className="text-secondary">Premium:</span> convide até {PLAN_LIMITS.premium.maxDuelFriends} amigos no mesmo duelo, liga e ranking de atletas
              </p>
            </div>
            <PremiumCTA />
          </div>
        )}

        {friends.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {friends.map(f => (
              <div key={f.id} className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 text-primary px-3 py-1.5 rounded-full">
                <span className="text-[11px] font-black uppercase italic">{f.name.split(' ')[0]}</span>
                <span className="text-[9px] font-bold opacity-70">Nv{f.level}</span>
                <button onClick={() => removeFriend(f.id)}>
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {premium && (
              <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest self-center px-1">
                {friends.length}/{maxDuelFriends}
              </span>
            )}
          </div>
        )}

        <AnimatePresence>
          {friends.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-col gap-3 overflow-hidden"
            >
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
                {friends.length > 1 ? `ENVIAR DESAFIO (${friends.length})` : 'ENVIAR DESAFIO'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
      )}

      {isIndividual && (
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

              {!showBoxPicker ? (
                <button
                  onClick={openBoxPicker}
                  className="w-full bg-surface-container-highest text-on-surface py-4 rounded-2xl font-headline font-black text-sm uppercase italic border border-outline-variant/10 flex items-center justify-center gap-2 hover:border-primary/40 transition-all"
                >
                  <Building2 className="w-5 h-5" />
                  QUERO ENTRAR NO BOX
                </button>
              ) : (
                <div className="flex flex-col gap-3">
                  <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">
                    Escolha o box
                  </p>
                  {loadingBoxes ? (
                    <div className="flex justify-center py-6">
                      <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : boxes.length === 0 ? (
                    <p className="text-center text-on-surface-variant text-xs font-bold uppercase py-4">
                      Nenhum box cadastrado ainda
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {boxes.map(box => (
                        <button
                          key={box.id}
                          onClick={() => setSelectedBoxId(box.id)}
                          className={cn(
                            'flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all text-left',
                            selectedBoxId === box.id
                              ? 'bg-primary/10 border-primary/40'
                              : 'bg-surface-container-highest border-transparent'
                          )}
                        >
                          {box.logo ? (
                            <img src={box.logo} alt={box.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Building2 className="w-4 h-4 text-primary" />
                            </div>
                          )}
                          <span className="text-sm font-bold text-on-surface uppercase italic truncate">{box.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowBoxPicker(false)}
                      className="flex-1 py-3 rounded-2xl border border-outline-variant/20 text-on-surface-variant font-headline font-black text-xs uppercase italic hover:border-primary/30 transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleJoinBox}
                      disabled={sendingJoin || !selectedBoxId}
                      className="flex-1 bg-primary text-background py-3 rounded-2xl font-headline font-black text-xs uppercase italic flex items-center justify-center gap-2 disabled:opacity-40 hover:opacity-90 transition-all"
                    >
                      {sendingJoin
                        ? <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin" />
                        : <Building2 className="w-4 h-4" />}
                      Confirmar Pedido
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}

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
                    {(log.hr_avg_pct || log.effort_index) && (
                      <div className="ml-12 flex items-center gap-2 flex-wrap">
                        {log.hr_avg_pct != null && (
                          <span className="text-[9px] font-black uppercase tracking-widest bg-secondary/10 text-secondary border border-secondary/20 px-2 py-0.5 rounded-full">
                            ❤️ {log.hr_avg_pct}% FCmáx
                          </span>
                        )}
                        {log.effort_index != null && (
                          <span className="text-[9px] font-black uppercase tracking-widest bg-surface-container-highest text-on-surface-variant px-2 py-0.5 rounded-full">
                            Esforço {log.effort_index}{log.hr_zone ? ` · ${log.hr_zone}` : ''}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </main>

      <button
        onClick={() => (showForm ? closeForm() : openBlankForm())}
        className="fixed bottom-28 right-6 h-14 pl-5 pr-6 bg-primary text-background rounded-2xl shadow-xl flex items-center gap-2 hover:scale-105 active:scale-95 transition-all"
      >
        {showForm ? <X className="w-5 h-5" strokeWidth={3} /> : <Plus className="w-5 h-5" strokeWidth={3} />}
        <span className="font-headline font-black text-xs uppercase italic tracking-wide whitespace-nowrap">
          {showForm ? 'Fechar' : 'Novo Registro'}
        </span>
      </button>

      {showTimer && (
        <WodTimer
          onClose={() => setShowTimer(false)}
          onFinish={handleTimerFinish}
          userId={user?.id}
          initialTitle={pendingPlacarWod?.wod_name}
          initialType={pendingPlacarWod && TIMER_TYPES.includes(pendingPlacarWod.wod_type as WodTimerType)
            ? (pendingPlacarWod.wod_type as WodTimerType) : undefined}
          initialDescription={pendingPlacarWod?.description || undefined}
        />
      )}
    </div>
  );
}
