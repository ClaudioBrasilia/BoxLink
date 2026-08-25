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
  Zap,
  Coins,
  Activity,
  ChevronRight,
  ChevronDown,
  Send,
  Calendar,
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
import { isTimeBasedType, isAmrapType } from '../lib/pace';
import { APP_NAME } from '../lib/appMode';
import WodTimer, { WodTimerResult, WodTimerType } from '../components/WodTimer';
import TimeInput from '../components/TimeInput';
import AmrapInput from '../components/AmrapInput';
import PostWorkoutFeedback from '../components/PostWorkoutFeedback';
import AvatarPreview from '../components/AvatarPreview';
import DailyWodPanel from '../components/DailyWodPanel';
import PremiumCTA from '../components/PremiumCTA';
import HeartRateWidget from '../components/HeartRateWidget';
import ReadinessCard from '../components/ReadinessCard';
import ShopBanner from '../components/ShopBanner';
import FirstSteps from '../components/FirstSteps';
import { AppSponsorBanner, useSponsors } from '../components/SponsorBanner';
import { postDailyWodResult } from '../lib/dailyWods';
import { normalizeFriendCode } from '../lib/friendCode';
import { useDailyWodRows, WodResultRow } from '../hooks/useDailyWodRows';
import { useNavigate } from 'react-router-dom';
import { calculateReadiness } from '../lib/readiness';
import { calculateCardioReadinessSignal, CardioReadinessSignal } from '../lib/cardioReadiness';
import { fetchHeartRateSessions } from '../lib/heartRateSessions';
import { calculateFamilyCardioSignal } from '../lib/crossfitReadiness';
import { buildCrossFitSuggestion } from '../lib/crossfitSuggestions';
import { calculateHrvReadinessSignal, hrvRecordsFromHealthSessions, type HrvReadinessSignal } from '../lib/hrv';

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

/** Resultado do WOD no formato do próprio tipo — FOR TIME em mm:ss, AMRAP em
 *  rounds + reps, o resto em texto livre. É o mesmo formato do cronômetro, do
 *  placar e do duelo, então o resultado registrado aqui compara com o dos
 *  outros sem tradução (e "12:45" deixa de ser digitável como "12.45"). */
function WodResultField({ wodType, value, onChange }: {
  wodType: string;
  value: string;
  onChange: (val: string) => void;
}) {
  if (isTimeBasedType(wodType)) return <TimeInput compact value={value} onChange={onChange} />;
  if (isAmrapType(wodType)) return <AmrapInput compact value={value} onChange={onChange} />;
  return (
    <input
      type="text"
      placeholder="Resultado (ex: 150 reps)"
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full bg-surface-container-highest rounded-2xl px-4 py-3 text-sm font-bold text-on-surface outline-none"
    />
  );
}

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

/**
 * Consistência sustentável: conta sessões recentes permitindo até um dia de
 * descanso entre treinos. O streak diário acima permanece inalterado para não
 * quebrar a expectativa ou as recompensas existentes.
 */
const calcSustainableStreak = (dates: string[]): number => {
  if (dates.length === 0) return 0;
  const unique = Array.from(new Set(dates)).sort().reverse();
  const today = todayBR();
  const yesterday = new Date(Date.now() - 86400000)
    .toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const twoDaysAgo = new Date(Date.now() - 2 * 86400000)
    .toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  if (![today, yesterday, twoDaysAgo].includes(unique[0])) return 0;

  let sessions = 1;
  for (let i = 1; i < unique.length; i++) {
    const prev = new Date(unique[i - 1] + 'T00:00:00').getTime();
    const curr = new Date(unique[i] + 'T00:00:00').getTime();
    if (prev - curr <= 2 * 86400000) sessions++;
    else break;
  }
  return sessions;
};

const parseLoad = (value: string): number =>
  parseFloat(String(value).replace(',', '.').replace(/[^0-9.]/g, '')) || 0;


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
  const [cardioSignal, setCardioSignal] = useState<CardioReadinessSignal | null>(null);
  const [hrvSignal, setHrvSignal] = useState<HrvReadinessSignal | null>(null);
  const [showReadinessDetail, setShowReadinessDetail] = useState(false);

  const [category, setCategory] = useState<TrainingLogCategory>('wod');
  const [title, setTitle] = useState('');
  const [wodType, setWodType] = useState('FOR TIME');
  const [description, setDescription] = useState('');
  const [result, setResult] = useState('');
  const [exercise, setExercise] = useState('');
  const [loadKg, setLoadKg] = useState('');
  const [rpe, setRpe] = useState(0);
  const [feeling, setFeeling] = useState<TrainingFeeling | null>(null);
  const [sleepHours, setSleepHours] = useState('');
  const [notes, setNotes] = useState('');
  const [postToPlacar, setPostToPlacar] = useState(true);
  const [placarScaling, setPlacarScaling] = useState<'rx' | 'scaled'>('rx');
  const [placarRefreshKey, setPlacarRefreshKey] = useState(0);
  // Incrementa quando o botão "Postar WOD" da Início é tocado — abre o
  // formulário de WOD lá no Placar (o único lugar que escreve no placar).
  const [placarFormKey, setPlacarFormKey] = useState(0);
  // Qual WOD foi escolhido pra treinar agora (tocado no card do Placar) —
  // usado pra pré-carregar o cronômetro e gravar o resultado na linha certa.
  const [wodToTrain, setWodToTrain] = useState<WodResultRow | null>(null);
  // Quando definido, o "Novo Registro" está em modo "adicionar detalhes" a um
  // treino que o cronômetro já salvou — o save vira UPDATE, não um INSERT novo.
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  // Linha do placar (daily_wod_results) ligada ao treino em edição — garante
  // que ajustar o resultado em "Detalhes do Treino" bata na MESMA linha.
  const [placarRowId, setPlacarRowId] = useState<string | null>(null);
  // Chips de "escolher o treino do dia" no Novo Registro ficam escondidos até
  // o atleta tocar pra abrir — reduz a poluição visual do formulário.
  const [showPlacarWodPicker, setShowPlacarWodPicker] = useState(false);

  const [codeInput, setCodeInput] = useState('');
  const [searchingFriend, setSearchingFriend] = useState(false);
  // Sugestão de amigos abaixo do campo de busca — abre ao tocar nele.
  const [friendPickerOpen, setFriendPickerOpen] = useState(false);
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  // Amigos de duelos anteriores — salvos pra escolher direto, sem digitar o
  // código de novo (a lista é mútua: aparece pros dois lados do duelo).
  const [savedFriends, setSavedFriends] = useState<FriendProfile[]>([]);
  const [duelName, setDuelName] = useState('');
  // Texto livre porque o tipo pode vir copiado do WOD do dia (que aceita
  // TABATA/OUTRO além dos três do desafio livre).
  const [duelType, setDuelType] = useState<string>('FOR TIME');
  const [duelDesc, setDuelDesc] = useState('');
  // Premium: números do WOD para calcular o ritmo (reps/min) no recap do duelo
  const [duelTotalReps, setDuelTotalReps] = useState('');
  const [duelTimeCapMinutes, setDuelTimeCapMinutes] = useState('');
  // AMRAP: reps de um round completo — o resultado do duelo vem em "rounds+reps"
  const [duelRepsPerRound, setDuelRepsPerRound] = useState('');
  // WOD de hoje escolhido como desafio (chip marcado) — só controla a seleção
  // visual; o duelo em si continua guardando nome/tipo/movimentos copiados.
  const [duelFromWodId, setDuelFromWodId] = useState<string | null>(null);
  // Desafio livre: escreve um WOD que não foi postado hoje. Fica fechado por
  // padrão — o caminho normal é tocar no chip do WOD do dia.
  const [showFreeDuel, setShowFreeDuel] = useState(false);
  const [creatingDuel, setCreatingDuel] = useState(false);
  // Card de Amigos e Duelos fechado por padrão — igual aos cards de WOD, só
  // o cabeçalho aparece até o atleta tocar pra abrir.
  const [duelPanelOpen, setDuelPanelOpen] = useState(false);

  // Números da "Início" do individual — equivalentes ao que o Box mostra no
  // Dashboard (lá é ranking do box e desafios do box; aqui é a Liga da
  // comunidade individual e os duelos por código de amigo).
  const [ligaPosition, setLigaPosition] = useState<number | null>(null);
  const [activeDuels, setActiveDuels] = useState<{ id: string; name: string; status: string }[]>([]);

  const [joinRequest, setJoinRequest] = useState<{ id: string; status: string } | null>(null);
  const [sendingJoin, setSendingJoin] = useState(false);
  const [showBoxPicker, setShowBoxPicker] = useState(false);
  const [boxes, setBoxes] = useState<{ id: string; name: string; logo?: string | null }[]>([]);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const [loadingBoxes, setLoadingBoxes] = useState(false);

  // Patrocinadores são do app inteiro (a tabela não tem vínculo com box — quem
  // manda é a flag show_on_app), então valem para o individual também.
  const sponsors = useSponsors();

  const premium = isPremium(user);
  const maxDuelFriends = planLimits(user).maxDuelFriends;

  // Avatar já personalizado: qualquer peça equipada além do visual que a conta
  // ganha no cadastro (base_outfit = 'default_base', o resto vazio). Usado no
  // checklist dos primeiros passos.
  const avatarCustomized = useMemo(() => {
    const equipped = (user?.avatar?.equipped || {}) as Partial<AvatarSlot>;
    return Object.entries(equipped).some(([slot, value]) =>
      slot === 'base_outfit' ? value && value !== 'default_base' : !!value
    );
  }, [user?.avatar?.equipped]);

  // Dias restantes do Premium (trial automático ou concessão manual com
  // validade) — null quando não é Premium ou não tem data de expiração
  // (concessão vitalícia, sem validade).
  const planDaysLeft = premium && user?.planExpiresAt
    ? Math.ceil((new Date(user.planExpiresAt).getTime() - Date.now()) / 86400000)
    : null;

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
    if (!user) {
      setCardioSignal(null);
      setHrvSignal(null);
      return;
    }
    let cancelled = false;
    const loadCardioReadiness = async () => {
      const sessions = await fetchHeartRateSessions(user.id, 30);
      if (!cancelled) setHrvSignal(calculateHrvReadinessSignal(hrvRecordsFromHealthSessions(sessions)));
      if (sessions.length === 0) {
        if (!cancelled) setCardioSignal(null);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('wod_results')
          .select('hr_session_id')
          .eq('user_id', user.id)
          .not('hr_session_id', 'is', null);
        if (error) throw error;
        const linkedIds = new Set<string>(
          (data || [])
            .map(row => row.hr_session_id)
            .filter((id): id is string => typeof id === 'string' && id.length > 0),
        );
        if (!cancelled) setCardioSignal(calculateCardioReadinessSignal(sessions, linkedIds));
      } catch (error) {
        console.warn('[Readiness] sessões vinculadas indisponíveis:', error);
        if (!cancelled) setCardioSignal(null);
      }
    };
    loadCardioReadiness();
    return () => { cancelled = true; };
  }, [user]);

  const loadSavedFriends = async () => {
    if (!user || !isIndividual) return;
    const { data } = await supabase
      .from('duel_friends')
      .select('user_id, friend_id')
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);
    const otherIds = [...new Set((data || []).map(row => row.user_id === user.id ? row.friend_id : row.user_id))];
    if (otherIds.length === 0) { setSavedFriends([]); return; }
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, level, xp, friend_code')
      .in('id', otherIds);
    setSavedFriends((profiles || []) as FriendProfile[]);
  };

  useEffect(() => { if (user) loadSavedFriends(); }, [user]);

  // Posição na Liga do mês (mesma conta da página Liga: XP ganho no mês entre
  // atletas individuais) e duelos em aberto — os dois cards de "status" da
  // Início, no lugar do ranking do box e dos desafios do box.
  const loadHomeStats = async () => {
    if (!user || !isIndividual) return;
    const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString().split('T')[0];
    try {
      const [{ data: profiles }, { data: rewards }, { data: duels }] = await Promise.all([
        supabase.from('profiles').select('id, level')
          .eq('account_type', 'individual').eq('status', 'approved'),
        supabase.from('reward_history').select('user_id, xp')
          .gte('created_at', firstDayOfMonth + 'T00:00:00'),
        supabase.from('duels').select('id, name, status')
          .neq('status', 'finished')
          .or(`challenger_id.eq.${user.id},opponent_ids.cs.{${user.id}}`)
          .order('created_at', { ascending: false }),
      ]);

      const monthXpByUser: Record<string, number> = {};
      (rewards || []).forEach((r: any) => {
        if (r.xp > 0) monthXpByUser[r.user_id] = (monthXpByUser[r.user_id] || 0) + r.xp;
      });
      const ranked = (profiles || [])
        .map((p: any) => ({ id: p.id, level: p.level || 1, monthXp: monthXpByUser[p.id] || 0 }))
        .filter(a => a.monthXp > 0)
        .sort((a, b) => b.monthXp - a.monthXp || b.level - a.level);
      const idx = ranked.findIndex(a => a.id === user.id);
      setLigaPosition(idx >= 0 ? idx + 1 : null);

      setActiveDuels((duels || []) as { id: string; name: string; status: string }[]);
    } catch (err) {
      console.error('Error loading home stats:', err);
    }
  };

  useEffect(() => { if (user) loadHomeStats(); }, [user]);

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

  const activityDates = useMemo(() => [
    ...logs.map(l => l.date),
    ...(user?.checkins || []).map(c => c.date),
  ], [logs, user?.checkins]);

  const streak = useMemo(() => calcStreak(activityDates), [activityDates]);
  const sustainableStreak = useMemo(() => calcSustainableStreak(activityDates), [activityDates]);
  const familyCardioSignal = useMemo(() => calculateFamilyCardioSignal(logs), [logs]);
  const effectiveCardioSignal = familyCardioSignal?.baselineCount >= 3 ? familyCardioSignal : cardioSignal;

  const readiness = useMemo(() => {
    const now = Date.now();
    const recentLogs = logs.filter(log => {
      const timestamp = new Date(`${log.date}T12:00:00`).getTime();
      return Number.isFinite(timestamp) && now - timestamp <= 28 * 86400000;
    });
    const feedbackLogs = recentLogs.filter(log =>
      log.feeling != null || (typeof log.rpe === 'number' && Number.isFinite(log.rpe)) ||
      (typeof log.sleep_hours === 'number' && log.sleep_hours > 0)
    );
    const latest = feedbackLogs[0];
    const rpeValues = feedbackLogs
      .map(log => log.rpe)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    const sleepValues = feedbackLogs
      .map(log => log.sleep_hours)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0);
    let consecutiveTired = 0;
    for (const log of feedbackLogs) {
      if (log.feeling === 'cansado') consecutiveTired++;
      else break;
    }
    let consecutiveHighRpe = 0;
    for (const log of feedbackLogs) {
      if (typeof log.rpe === 'number' && log.rpe >= 8) consecutiveHighRpe++;
      else break;
    }

    return calculateReadiness({
      latestFeeling: latest?.feeling,
      latestRpe: latest?.rpe,
      averageRpe: rpeValues.length > 0 ? rpeValues.reduce((sum, value) => sum + value, 0) / rpeValues.length : null,
      latestSleepHours: latest?.sleep_hours,
      averageSleepHours: sleepValues.length > 0 ? sleepValues.reduce((sum, value) => sum + value, 0) / sleepValues.length : null,
      consecutiveTired,
      consecutiveHighRpe,
      cardioLoadDeltaPct: effectiveCardioSignal?.deltaPct,
      cardioBaselineCount: effectiveCardioSignal?.baselineCount,
      cardioConfidence: effectiveCardioSignal?.confidence,
      hrvDeltaPct: hrvSignal?.deltaPct,
      hrvBaselineCount: hrvSignal?.baselineCount,
      hrvConfidence: hrvSignal?.confidence,
      rpeSampleCount: rpeValues.length,
      sleepSampleCount: sleepValues.length,
      latestDataDate: latest?.date ?? hrvSignal?.latestAt?.slice(0, 10),
    });
  }, [logs, effectiveCardioSignal, hrvSignal]);

  const readinessSuggestion = useMemo(() => buildCrossFitSuggestion({
    status: readiness.status,
    reasons: readiness.reasons,
    family: familyCardioSignal?.family,
  }), [readiness, familyCardioSignal]);

  const loggedToday = logs.some(l => l.date === todayBR());
  const checkedInToday = (user?.checkins || []).some(c => c.date === todayBR());

  // Treinos da semana (domingo a sábado, fuso Brasil) — equivalente ao
  // "Check-ins Semana" do Box, mas contando dia treinado, venha do registro
  // do diário ou do check-in solo.
  const trainingsThisWeek = useMemo(() => {
    const nowBR = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const startOfWeek = new Date(nowBR);
    startOfWeek.setDate(nowBR.getDate() - nowBR.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const dates = new Set([
      ...logs.map(l => l.date),
      ...(user?.checkins || []).map(c => c.date),
    ]);
    return [...dates].filter(d => new Date(d + 'T00:00:00') >= startOfWeek).length;
  }, [logs, user?.checkins]);

  const logsByDate = useMemo(() => {
    const groups: Record<string, TrainingLog[]> = {};
    logs.forEach(l => { (groups[l.date] ||= []).push(l); });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [logs]);

  // WODs que o atleta já postou hoje e ainda não treinou — no "Novo Registro"
  // ele pode escolher um deles em vez de redigitar nome/tipo/movimentos, e a
  // escolha faz o resultado bater na MESMA linha do placar (sem duplicar).
  const { rows: placarRows } = useDailyWodRows(placarRefreshKey);
  const myOpenPlacarWods = useMemo(
    () => placarRows.filter(r => r.user_id === user?.id && !r.result),
    [placarRows, user?.id]
  );

  // Para o duelo, TODOS os WODs que o atleta postou hoje — inclusive os já
  // treinados: desafiar alguém a repetir o WOD que você acabou de fazer é
  // justamente o caso comum (diferente do "Novo Registro", que só oferece os
  // que faltam treinar porque lá o objetivo é preencher o resultado).
  const myWodsToday = useMemo(
    () => placarRows.filter(r => r.user_id === user?.id),
    [placarRows, user?.id]
  );

  // Sugestões do campo de busca: amigos de duelos anteriores que ainda não
  // estão neste desafio. Sem texto (campo recém-tocado) mostra todos; com
  // texto filtra por nome — quem não está na lista continua entrando por
  // código, pelo botão Buscar.
  const friendSuggestions = useMemo(() => {
    const available = savedFriends.filter(f => !friends.some(x => x.id === f.id));
    const query = codeInput.trim().toLowerCase();
    if (!query) return available;
    return available.filter(f => f.name.toLowerCase().includes(query));
  }, [savedFriends, friends, codeInput]);

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
    setFeeling(null); setSleepHours(''); setNotes(''); setWodType('FOR TIME');
    setEffortData(null); setPostToPlacar(true); setPlacarScaling('rx');
    setEditingLogId(null); setPlacarRowId(null);
  };

  const closeForm = () => { setShowForm(false); resetForm(); };
  const openBlankForm = () => { resetForm(); setShowForm(true); };

  // Escolhe (ou desmarca) um WOD já postado hoje como o que este registro vai
  // completar — pré-preenche nome/tipo/movimentos e faz o resultado bater na
  // MESMA linha do placar em vez de criar uma segunda entrada.
  const selectPlacarWod = (row: (typeof myOpenPlacarWods)[number]) => {
    if (placarRowId === row.id) {
      setPlacarRowId(null); setTitle(''); setWodType('FOR TIME'); setDescription(''); setLoadKg('');
      return;
    }
    setPlacarRowId(row.id);
    setTitle(row.wod_name); setWodType(row.wod_type);
    setDescription(row.description || ''); setPlacarScaling(row.scaling);
    // Carga sugerida no WOD vira o palpite da carga usada — editável.
    setLoadKg(row.target_load_kg != null ? String(row.target_load_kg) : '');
    setPostToPlacar(true);
  };

  const clearDuelWod = () => {
    setDuelFromWodId(null);
    setDuelName(''); setDuelType('FOR TIME'); setDuelDesc('');
    setDuelTotalReps(''); setDuelTimeCapMinutes(''); setDuelRepsPerRound('');
  };

  /** Desafiar com um WOD já postado hoje: o desafio É aquele WOD, então
   *  nome/tipo/movimentos vêm copiados dele em vez de redigitados. O tipo vai
   *  como está no WOD (inclusive TABATA/OUTRO) — quem decide se o placar é
   *  por tempo ou por reps é o próprio tipo, lá no duelo. */
  const selectDuelWod = (row: (typeof myWodsToday)[number]) => {
    if (duelFromWodId === row.id) { clearDuelWod(); return; }
    setShowFreeDuel(false);
    setDuelFromWodId(row.id);
    setDuelName(row.wod_name);
    setDuelType(row.wod_type || 'FOR TIME');
    setDuelDesc(row.description || '');
    // Números já cadastrados no placar liberam o ritmo sem redigitar.
    setDuelTotalReps(row.total_reps != null ? String(row.total_reps) : '');
    setDuelTimeCapMinutes(row.time_cap_minutes != null ? String(row.time_cap_minutes) : '');
    setDuelRepsPerRound(row.reps_per_round != null ? String(row.reps_per_round) : '');
  };

  /** Abre/fecha o desafio livre (WOD que não foi postado hoje). */
  const toggleFreeDuel = () => {
    if (showFreeDuel) { setShowFreeDuel(false); clearDuelWod(); return; }
    clearDuelWod();
    setShowFreeDuel(true);
  };

  const handleSave = async () => {
    if (!user) return;

    // Modo "detalhes do treino": o treino já foi salvo pelo cronômetro —
    // aqui atualiza a MESMA linha (nome/tipo/resultado, se ajustados, mais
    // RPE/sensação/notas) e sincroniza o placar, sem duplicar nada.
    if (editingLogId) {
      if (!title.trim()) { toast.warning('Dê um nome ao WOD.'); return; }
      setSaving(true);
      try {
        const parsedLoadKg = loadKg ? parseFloat(loadKg.replace(',', '.')) : null;
        const { error } = await supabase.from('training_logs').update({
          title: title.trim(),
          wod_type: wodType,
          description: description.trim() || null,
          result: result.trim() || null,
          load_kg: parsedLoadKg,
          rpe: rpe > 0 ? rpe : null,
          feeling,
          sleep_hours: sleepHours ? parseLoad(sleepHours) : null,
          notes: notes.trim() || null,
        }).eq('id', editingLogId);
        if (error) throw error;

        if (isIndividual && result.trim()) {
          try {
            const outcome = await postDailyWodResult({
              userId: user.id, wodName: title.trim(), wodType, result: result.trim(),
              scaling: placarScaling, description: description.trim() || undefined,
              id: placarRowId || undefined, loadKg: parsedLoadKg,
              hrAvgPct: effortData?.avgPctMax ?? null,
              effortIndex: effortData?.effortIndex ?? null,
              hrZone: effortData?.dominantZone ?? null,
            });
            setPlacarRowId(outcome.id);
            setPlacarRefreshKey(k => k + 1);
          } catch (err) {
            console.error('Error syncing placar from details:', err);
            toast.warning('Detalhes salvos no diário, mas o resultado não entrou no placar.');
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
      const parsedLoadKg = loadKg ? parseFloat(loadKg.replace(',', '.')) : null;
      const { error } = await supabase.from('training_logs').insert({
        user_id: user.id,
        date: todayBR(),
        title: category === 'forca' ? (title.trim() || exercise.trim()) : title.trim(),
        category,
        wod_type: category === 'wod' ? wodType : null,
        description: description.trim() || null,
        result: result.trim() || null,
        exercise: category === 'forca' ? exercise.trim() : null,
        load_kg: (category === 'forca' || category === 'wod') ? parsedLoadKg : null,
        rpe: rpe > 0 ? rpe : null,
        feeling,
        sleep_hours: sleepHours ? parseLoad(sleepHours) : null,
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
            description: description.trim() || undefined, loadKg: parsedLoadKg,
            id: placarRowId || undefined,
            hrAvgPct: eff?.avgPctMax ?? null,
            effortIndex: eff?.effortIndex ?? null,
            hrZone: eff?.dominantZone ?? null,
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
      const scaling = wodToTrain?.scaling || 'rx';
      const trainedWodId = wodToTrain?.id;
      // Carga sugerida no WOD do dia entra como carga usada por padrão — quem
      // treinou com outra corrige no formulário de detalhes que abre a seguir.
      const trainedLoadKg = wodToTrain?.target_load_kg ?? null;
      setWodToTrain(null);

      const { data: inserted, error } = await supabase.from('training_logs').insert({
        user_id: user.id,
        date: todayBR(),
        title: wodName,
        category: 'wod',
        wod_type: data.wodType,
        description: data.description.trim() || null,
        result: wodResult || null,
        load_kg: trainedLoadKg,
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
            id: trainedWodId,
            loadKg: trainedLoadKg ?? undefined,
            // Duração usada no cronômetro: é o que fecha o ritmo do AMRAP
            // quando o WOD nasceu aqui, sem ter passado pelo "Postar WOD".
            timeCapMinutes: data.timeCapMinutes,
            hrAvgPct: eff?.avgPctMax ?? null,
            effortIndex: eff?.effortIndex ?? null,
            hrZone: eff?.dominantZone ?? null,
          });
          setPlacarRowId(placarOutcome.id);
          setPlacarRefreshKey(k => k + 1);
        } catch (err) {
          // Falhar aqui deixa o WOD do dia marcado como "falta treinar" mesmo
          // com o treino salvo no diário — silenciar isso faz o atleta achar
          // que o app perdeu o resultado. Avisa e diz onde o resultado está.
          console.error('Error posting placar from timer:', err);
          toast.warning('Treino salvo no diário, mas o resultado não entrou no placar. Toque em "Editar" no WOD para tentar de novo.');
        }
      }

      await refreshBalances();
      await loadLogs();
      await loadHomeStats();

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
      setLoadKg(trainedLoadKg != null ? String(trainedLoadKg) : '');
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
    const text = `⚔️ Me desafie para um duelo no ${APP_NAME}! Meu código de atleta: ${user.friendCode} — ${window.location.origin}`;
    if (navigator.share) navigator.share({ title: `${APP_NAME} — Duelo`, text }).catch(() => {});
    else handleCopyCode();
  };

  /** Grava a amizade (mútua) — é esta lista que forma a Liga de amigos. */
  const saveFriend = async (f: FriendProfile) => {
    if (!user) return;
    try {
      await supabase.from('duel_friends')
        .upsert({ user_id: user.id, friend_id: f.id }, { onConflict: 'user_id,friend_id', ignoreDuplicates: true });
      await loadSavedFriends();
    } catch (err) {
      console.error('Error saving friend:', err);
    }
  };

  const handleFindFriend = async () => {
    if (!user || !codeInput.trim()) return;
    const code = normalizeFriendCode(codeInput);
    // O campo aceita nome ou código, mas só o código encontra alguém novo —
    // nome serve pra filtrar a lista de sugestões logo abaixo.
    if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) {
      toast.warning('Toque num amigo da lista ou digite o código dele (ex: AB2C-3DEF).');
      return;
    }
    if (code === user.friendCode) {
      toast.warning('Esse é o seu próprio código! Chame um colega. 😄'); return;
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
      const found = data as FriendProfile;
      const firstName = found.name.split(' ')[0];

      // Achou pelo código = já vira amigo, sem depender de criar duelo. Antes
      // a amizade só era gravada ao ENVIAR um desafio, então não dava pra
      // montar a liga sem desafiar cada pessoa antes.
      await saveFriend(found);

      // O limite do plano é por duelo, não por amizade — então ele só impede
      // de entrar neste desafio, nunca de virar amigo.
      if (friends.some(f => f.id === found.id)) {
        toast.success(`${firstName} já está neste desafio.`);
      } else if (friends.length >= maxDuelFriends) {
        toast.success(premium
          ? `${firstName} salvo nos amigos! Limite de ${maxDuelFriends} por duelo já atingido.`
          : `${firstName} salvo nos amigos! No plano grátis você chama 1 por duelo — Premium: até ${PLAN_LIMITS.premium.maxDuelFriends}.`);
      } else {
        setFriends(prev => [...prev, found]);
        toast.success(`${firstName} adicionado aos amigos e ao desafio!`);
      }
      setCodeInput('');
    } catch (err: any) {
      console.error('Error finding friend:', err);
      toast.error('Erro ao buscar atleta.');
    } finally {
      setSearchingFriend(false);
    }
  };

  const removeFriend = (id: string) => setFriends(prev => prev.filter(f => f.id !== id));

  // Escolhe um amigo já salvo (de um duelo anterior) direto pra este desafio,
  // sem precisar digitar o código de novo.
  const addSavedFriend = (f: FriendProfile) => {
    if (friends.some(x => x.id === f.id)) return;
    if (friends.length >= maxDuelFriends) {
      toast.warning(premium
        ? `Limite de ${maxDuelFriends} amigos por duelo.`
        : `No plano grátis você chama 1 amigo por duelo. Premium: até ${PLAN_LIMITS.premium.maxDuelFriends}.`);
      return;
    }
    setFriends(prev => [...prev, f]);
  };

  const removeSavedFriend = async (friendId: string) => {
    if (!user) return;
    setSavedFriends(prev => prev.filter(f => f.id !== friendId));
    try {
      await supabase.from('duel_friends').delete()
        .or(`and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id})`);
    } catch (err) {
      console.error('Error removing saved friend:', err);
    }
  };

  const handleCreateDuel = async () => {
    if (!user || friends.length === 0) return;
    if (!duelName.trim()) {
      toast.warning('Escolha um WOD de hoje ou escreva um desafio.'); return;
    }
    // Descrição só é obrigatória no desafio livre: vindo de um WOD do dia,
    // os movimentos podem não ter sido preenchidos no momento de postar.
    if (showFreeDuel && !duelDesc.trim()) {
      toast.warning('Preencha a descrição do desafio.'); return;
    }
    setCreatingDuel(true);
    try {
      const opponentIds = friends.map(f => f.id);
      const results: Record<string, null> = { [user.id]: null };
      opponentIds.forEach(id => { results[id] = null; });

      // Números do WOD (viram o ritmo reps/min) — livres pra todo mundo desde
      // que o campo deixou de ser Premium; só a leitura comparativa no recap
      // continua paga.
      const totalReps = isTimeBasedType(duelType) && duelTotalReps.trim()
        ? parseInt(duelTotalReps, 10) || null
        : null;
      const timeCapMinutes = isAmrapType(duelType) && duelTimeCapMinutes.trim()
        ? parseInt(duelTimeCapMinutes, 10) || null
        : null;
      // AMRAP: reps de um round completo — converte o "rounds+reps" que cada
      // um envia no duelo em total de reps (ritmo e comparação).
      const repsPerRound = isAmrapType(duelType) && duelRepsPerRound.trim()
        ? parseInt(duelRepsPerRound, 10) || null
        : null;

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
        total_reps: totalReps,
        time_cap_minutes: timeCapMinutes,
        reps_per_round: repsPerRound,
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

      // Guarda quem participou pra aparecer na lista de amigos da próxima vez
      // — não precisa dar erro no duelo se isso falhar (é só conveniência).
      try {
        await supabase.from('duel_friends')
          .upsert(friends.map(f => ({ user_id: user.id, friend_id: f.id })), { onConflict: 'user_id,friend_id', ignoreDuplicates: true });
        await loadSavedFriends();
        await loadHomeStats();
      } catch (err) {
        console.error('Error saving duel friends:', err);
      }

      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#CAFD00', '#ffffff'] });
      toast.success(friends.length === 1
        ? `Duelo enviado para ${friends[0].name}! Acompanhe na aba Duelos. ⚔️`
        : `Duelo enviado para ${friends.length} amigos! Acompanhe na aba Duelos. ⚔️`);
      setFriends([]); setCodeInput('');
      clearDuelWod(); setShowFreeDuel(false);
    } catch (err: any) {
      console.error('Error creating friend duel:', err);
      toast.error('Erro ao criar duelo: ' + err.message);
    } finally {
      setCreatingDuel(false);
    }
  };

  // Bloco reaproveitado tanto no "Novo Registro" (manual) quanto em
  // "Detalhes do Treino" (após o cronômetro) — mesmo estado, duas telas.
  const postWorkoutFeedback = (
    <PostWorkoutFeedback
      showRpe={category !== 'nota'}
      rpe={rpe} onRpeChange={setRpe}
      feeling={feeling} onFeelingChange={setFeeling}
      sleepHours={sleepHours} onSleepHoursChange={setSleepHours}
      notes={notes} onNotesChange={setNotes}
    />
  );

  return (
    <div className="min-h-screen bg-background pb-32">

      <header className="p-6 pt-12 flex flex-col gap-4">
        {/* O individual usa esta página como Início do app (ele não tem o
            Dashboard do box), então o topo espelha o do Box: avatar, saudação,
            nível/XP, moedas e compartilhar. O box mantém o título simples,
            porque pra ele o Diário é só mais uma página. */}
        {isIndividual ? (
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/avatar')}
                className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 overflow-hidden flex items-center justify-center hover:border-primary/50 active:scale-95 transition-all flex-shrink-0"
                aria-label="Personalizar avatar"
              >
                <AvatarPreview
                  equipped={(user?.avatar?.equipped || {}) as AvatarSlot}
                  size="sm"
                  className="w-full h-full border-none shadow-none"
                />
              </button>
              <div>
                <h1 className="text-2xl font-headline font-black text-on-surface tracking-tight uppercase italic leading-none">
                  OLÁ, <span className="text-primary">{user?.name?.split(' ')[0]}</span>
                </h1>
                <p className="text-on-surface-variant text-[10px] font-bold tracking-widest uppercase mt-1 italic">
                  {streak > 1 ? `🔥 ${streak} dias seguidos` : 'Pronto para o treino?'}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <div className="flex items-center gap-2 bg-surface-container-low px-3 py-1.5 rounded-full border border-outline-variant/10">
                <span className="text-[10px] font-black text-primary uppercase italic">LVL {user?.level}</span>
                <div className="w-[1px] h-3 bg-outline-variant/20" />
                <Zap className="w-4 h-4 text-primary fill-primary" />
                <span className="font-headline font-black text-sm text-on-surface">{user?.xp}</span>
              </div>
              <div className="flex items-center gap-2 bg-surface-container-low px-3 py-1.5 rounded-full border border-outline-variant/10">
                <Coins className="w-4 h-4 text-secondary fill-secondary" />
                <span className="font-headline font-black text-sm text-on-surface">{user?.coins}</span>
                <span className="text-[8px] font-bold text-on-surface-variant uppercase tracking-widest">BC</span>
              </div>
              <button
                onClick={handleShareCode}
                className="flex items-center gap-1 bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-full hover:bg-primary/20 transition-all"
              >
                <Share2 className="w-3 h-3 text-primary" />
                <span className="text-[8px] font-black text-primary uppercase tracking-widest">SHARE</span>
              </button>
            </div>
          </div>
        ) : (
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
        )}

        {planDaysLeft != null && (
          <div className="flex flex-col gap-2">
            <div className={cn(
              'rounded-2xl px-4 py-3 flex items-center gap-2 border',
              planDaysLeft <= 7 ? 'bg-secondary/10 border-secondary/30' : 'bg-primary/5 border-primary/20'
            )}>
              <span className="text-sm">{planDaysLeft <= 7 ? '⏳' : '⭐'}</span>
              <p className={cn(
                'text-[10px] font-bold uppercase tracking-widest leading-snug flex-1',
                planDaysLeft <= 7 ? 'text-secondary' : 'text-on-surface-variant'
              )}>
                {planDaysLeft <= 0
                  ? <>Seu <span className="text-secondary">Premium</span> vence hoje</>
                  : planDaysLeft === 1
                    ? <>Seu <span className="text-secondary">Premium</span> vence amanhã</>
                    : <>Seu <span className="text-secondary">Premium</span> vence em {planDaysLeft} dias</>}
              </p>
            </div>
            {planDaysLeft <= 7 && <PremiumCTA />}
          </div>
        )}

        <ReadinessCard
          result={readiness}
          suggestion={readinessSuggestion}
          compact
          onClick={() => setShowReadinessDetail(true)}
        />

        <AnimatePresence>
          {showReadinessDetail && (
            <motion.div
              className="fixed inset-0 z-[180] flex items-end justify-center bg-black/70 p-4 sm:items-center"
              role="dialog"
              aria-modal="true"
              aria-labelledby="readiness-detail-title"
              onClick={() => setShowReadinessDetail(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-background border border-outline-variant/20 p-3 shadow-2xl"
                onClick={(event) => event.stopPropagation()}
                initial={{ y: 32, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 32, opacity: 0 }}
                transition={{ type: 'spring', damping: 26, stiffness: 320 }}
              >
                <div className="flex items-center justify-between px-1 pb-3">
                  <h2 id="readiness-detail-title" className="text-sm font-headline font-black text-on-surface uppercase italic">
                    Detalhes da prontidão
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowReadinessDetail(false)}
                    className="w-9 h-9 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center"
                    aria-label="Fechar detalhes da prontidão"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <ReadinessCard result={readiness} suggestion={readinessSuggestion} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

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
              {sustainableStreak > 0 && (
                <p className="text-[8px] text-primary/80 font-bold uppercase tracking-wider mt-1">
                  {sustainableStreak} {sustainableStreak === 1 ? 'sessão' : 'sessões'} · ritmo sustentável
                </p>
              )}
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
          {/* Sem box não existe check-in por GPS/aula: aqui o "check-in" do dia
              é o treino registrado. Os outros dois cards são o equivalente do
              "Check-ins Semana" e "Ranking Box" do Dashboard. */}
          {isIndividual && (
            <>
              <div className="bg-surface-container rounded-3xl p-4 border border-outline-variant/10 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xl font-headline font-black text-on-surface italic leading-none">
                    {trainingsThisWeek}<span className="text-on-surface-variant text-sm">/6</span>
                  </p>
                  <p className="text-[9px] text-on-surface-variant font-black uppercase tracking-widest">Treinos semana</p>
                </div>
              </div>
              <button
                onClick={() => navigate('/liga')}
                className="bg-surface-container rounded-3xl p-4 border border-outline-variant/10 flex items-center gap-3 text-left hover:border-secondary/40 transition-all"
              >
                <div className="w-10 h-10 rounded-2xl bg-secondary/10 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-secondary" />
                </div>
                <div>
                  <p className="text-xl font-headline font-black text-on-surface italic leading-none">
                    {ligaPosition != null ? `#${ligaPosition}` : '—'}
                  </p>
                  <p className="text-[9px] text-on-surface-variant font-black uppercase tracking-widest">Liga do mês</p>
                </div>
              </button>
            </>
          )}
        </div>

        {/* Ação principal da Início do individual — mesmo peso visual do
            "FAZER CHECK-IN AGORA" do Box, já que aqui registrar o treino é o
            que dá o check-in solo e os pontos do dia. */}
        {isIndividual && (
          <button
            onClick={() => setPlacarFormKey(k => k + 1)}
            className="w-full py-6 rounded-3xl font-headline font-black text-lg shadow-lg transition-all uppercase italic tracking-tight flex items-center justify-center gap-3 bg-primary text-background hover:scale-[0.98] active:scale-95 shadow-[0_10px_30px_rgba(202,253,0,0.2)]"
          >
            POSTAR WOD
            <Send className="w-6 h-6" />
          </button>
        )}

        {!checkedInToday && (
          <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest text-center italic opacity-70">
            Registre seu primeiro treino do dia e ganhe o check-in solo + pontos
          </p>
        )}
      </header>

      {/* Blocos que o Dashboard do Box também tem, na mesma ordem: vitrine da
          loja, atalho do que está em aberto (lá desafios, aqui duelos) e o
          monitor de frequência cardíaca. */}
      {isIndividual && (
        <div className="px-6 mb-6 flex flex-col gap-5">
          {/* Guia de quem acabou de chegar: some sozinho quando os quatro
              passos estiverem feitos (ver FirstSteps). */}
          {!loading && (
            <FirstSteps
              hasFirstLog={logs.length > 0}
              hasAvatar={avatarCustomized}
              hasFriend={savedFriends.length > 0 || activeDuels.length > 0}
              inLeague={ligaPosition != null}
              onPostWod={() => setPlacarFormKey(k => k + 1)}
              onOpenFriends={() => document.getElementById('amigos-duelos')?.scrollIntoView({ behavior: 'smooth' })}
            />
          )}

          {/* Mesma dupla do Dashboard do Box: patrocínio e loja lado a lado. */}
          <div className="flex gap-3 items-start">
            <AppSponsorBanner sponsors={sponsors} className="flex-1 min-w-0" />
            <ShopBanner />
          </div>

          {activeDuels.length > 0 && (
            <button
              onClick={() => navigate('/duels')}
              className="bg-surface-container-low rounded-3xl border border-outline-variant/10 p-4 text-left hover:border-primary/30 transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-secondary/20 rounded-xl flex items-center justify-center">
                    <Swords className="w-4 h-4 text-secondary" />
                  </div>
                  <h3 className="text-[10px] font-black text-on-surface uppercase tracking-widest italic">Duelos em aberto</h3>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-black text-secondary bg-secondary/10 px-2 py-0.5 rounded-full">{activeDuels.length}</span>
                  <ChevronRight className="w-4 h-4 text-on-surface-variant" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {activeDuels.slice(0, 2).map(d => (
                  <div key={d.id} className="flex items-center justify-between bg-surface-container-highest/50 rounded-2xl px-3 py-2">
                    <p className="text-xs font-bold text-on-surface uppercase italic truncate flex-1">{d.name}</p>
                    <span className={cn(
                      'text-[9px] font-black uppercase ml-2 shrink-0',
                      d.status === 'active' ? 'text-primary' : 'text-on-surface-variant'
                    )}>
                      {d.status === 'active' ? 'Em andamento' : 'Aguardando'}
                    </span>
                  </div>
                ))}
                {activeDuels.length > 2 && (
                  <p className="text-[9px] text-center text-on-surface-variant font-bold uppercase tracking-widest">
                    +{activeDuels.length - 2} outros duelos
                  </p>
                )}
              </div>
            </button>
          )}

          <HeartRateWidget userId={user?.id} />
        </div>
      )}

      {/* Box não tem Placar de WODs (é da comunidade individual), então o
          cronômetro fica num botão simples aqui — sem WOD pré-carregado. */}
      {!isIndividual && (
        <button
          onClick={() => { setWodToTrain(null); setShowTimer(true); }}
          className="mx-6 mb-4 bg-gradient-to-r from-primary/15 to-secondary/10 border border-primary/25 rounded-3xl p-5 flex items-center gap-4 hover:border-primary/50 transition-all text-left w-[calc(100%-3rem)]"
        >
          <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center flex-shrink-0">
            <Timer className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-headline font-black text-base text-on-surface uppercase italic leading-tight">Iniciar Meu WOD</p>
            <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">
              Cronômetro For Time · AMRAP · EMOM · Tabata
            </p>
          </div>
          <Play className="w-5 h-5 text-primary flex-shrink-0" />
        </button>
      )}

      {/* Placar de WODs é a comunidade do individual — atleta de box já tem
          Feed/Ranking/WOD do dia próprios do box, não deve poluir nem ver este.
          Tocar num WOD "falta treinar" já abre o cronômetro carregado com ele. */}
      {isIndividual && (
        <>
          <div className="mx-6 mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-headline font-black italic text-on-surface uppercase tracking-tight">Seu WOD de hoje</h2>
              <p className="text-on-surface-variant text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Toque para ver os movimentos
              </p>
            </div>
            <button
              onClick={() => navigate('/liga?tab=wods_hoje')}
              className="flex items-center gap-1 text-[9px] font-black text-secondary uppercase tracking-widest hover:opacity-80 transition-all"
            >
              Placar <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <DailyWodPanel
            refreshSignal={placarRefreshKey}
            openFormSignal={placarFormKey}
            onStartWod={row => { setWodToTrain(row); setShowTimer(true); }}
            onFreeTrain={() => { setWodToTrain(null); setShowTimer(true); }}
          />
        </>
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
              <div className="flex flex-col gap-2">
                <select
                  value={wodType}
                  onChange={e => setWodType(e.target.value)}
                  className="w-full bg-surface-container-highest rounded-2xl px-4 py-3 text-sm font-medium text-on-surface outline-none"
                >
                  {WOD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                {/* key = tipo: trocar de FOR TIME pra AMRAP remonta o campo, que
                    relê o resultado no formato novo em vez de ficar preso ao velho. */}
                <WodResultField key={wodType} wodType={wodType} value={result} onChange={setResult} />
              </div>
              <input
                type="text"
                inputMode="decimal"
                placeholder="Carga usada (kg) — opcional"
                value={loadKg}
                onChange={e => setLoadKg(e.target.value)}
                className="w-full bg-surface-container-highest rounded-2xl px-4 py-3 text-sm font-medium text-on-surface outline-none"
              />
              <textarea
                placeholder="Movimentos / descrição"
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={2}
                className="w-full bg-surface-container-highest rounded-2xl px-4 py-3 text-sm font-medium text-on-surface outline-none resize-none"
              />

              {postWorkoutFeedback}

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
                {isIndividual && category === 'wod' && myOpenPlacarWods.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    {/* Chips escondidos atrás de uma seta — igual ao resto do
                        app — pra não pesar o formulário com um treino que já
                        tem nome próprio. */}
                    <button
                      type="button"
                      onClick={() => setShowPlacarWodPicker(o => !o)}
                      className="w-full flex items-center justify-between gap-2 bg-surface-container-highest/50 rounded-2xl px-4 py-3 border border-outline-variant/10"
                    >
                      <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest truncate">
                        {placarRowId
                          ? `Treino: ${myOpenPlacarWods.find(r => r.id === placarRowId)?.wod_name}`
                          : 'Ou escolha o treino do dia'}
                      </span>
                      <ChevronDown className={cn('w-4 h-4 text-on-surface-variant transition-transform flex-shrink-0', showPlacarWodPicker && 'rotate-180')} />
                    </button>
                    {showPlacarWodPicker && (
                      <div className="flex flex-wrap gap-2">
                        {myOpenPlacarWods.map(row => (
                          <button
                            key={row.id}
                            type="button"
                            onClick={() => selectPlacarWod(row)}
                            className={cn(
                              'px-3 py-2 rounded-xl text-[11px] font-black uppercase italic tracking-wide transition-all border',
                              placarRowId === row.id
                                ? 'bg-primary text-background border-primary'
                                : 'bg-surface-container-highest text-on-surface-variant border-transparent hover:border-primary/30'
                            )}
                          >
                            {row.wod_name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <input
                  type="text"
                  placeholder={category === 'nota' ? 'Título da nota' : 'Nome do treino (ex: Murph, WOD do dia)'}
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full bg-surface-container-highest rounded-2xl px-4 py-3 text-sm font-medium text-on-surface outline-none"
                />
                {category === 'wod' && (
                  <div className="flex flex-col gap-2">
                    <select
                      value={wodType}
                      onChange={e => setWodType(e.target.value)}
                      className="w-full bg-surface-container-highest rounded-2xl px-4 py-3 text-sm font-medium text-on-surface outline-none"
                    >
                      {WOD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <WodResultField key={wodType} wodType={wodType} value={result} onChange={setResult} />
                  </div>
                )}
                {category === 'wod' && (
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Carga usada (kg) — opcional"
                    value={loadKg}
                    onChange={e => setLoadKg(e.target.value)}
                    className="w-full bg-surface-container-highest rounded-2xl px-4 py-3 text-sm font-medium text-on-surface outline-none"
                  />
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

            {postWorkoutFeedback}

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
      <section id="amigos-duelos" className="mx-6 mb-6 bg-surface-container rounded-3xl border border-outline-variant/10 p-6 flex flex-col gap-4 scroll-mt-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-secondary/10 flex items-center justify-center flex-shrink-0">
            <Swords className="w-5 h-5 text-secondary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-headline font-black text-base text-on-surface uppercase italic leading-tight">Amigos e Duelos</h2>
            <p className="text-[9px] text-on-surface-variant font-bold uppercase tracking-widest">Seus amigos formam sua Liga — e você pode desafiá-los</p>
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

        {/* Um campo só: nome (filtra os amigos de duelos anteriores, na lista
            que abre abaixo) ou código (acha alguém novo, pelo botão Buscar). */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50" />
            <input
              type="text"
              placeholder="Nome ou código do amigo"
              value={codeInput}
              onChange={e => setCodeInput(e.target.value)}
              onFocus={() => setFriendPickerOpen(true)}
              // Atraso pro toque na sugestão acontecer antes do campo fechar.
              onBlur={() => setTimeout(() => setFriendPickerOpen(false), 150)}
              className="w-full bg-surface-container-highest rounded-2xl pl-9 pr-4 py-3 text-sm font-bold text-on-surface placeholder:text-on-surface-variant/40 outline-none tracking-wider"
            />
            {friendPickerOpen && friendSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 z-20 bg-surface-container-highest rounded-2xl border border-outline-variant/10 shadow-xl max-h-56 overflow-y-auto">
                {friendSuggestions.map(f => (
                  <div key={f.id} className="flex items-center gap-3 pl-4 pr-2 hover:bg-primary/10 transition-all">
                    <button
                      onClick={() => { addSavedFriend(f); setCodeInput(''); setFriendPickerOpen(false); }}
                      className="flex-1 flex items-center gap-3 py-3 text-left min-w-0"
                    >
                      <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center font-headline font-black text-sm text-on-surface flex-shrink-0">
                        {f.name[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-on-surface uppercase italic truncate">{f.name}</p>
                        <p className="text-[10px] text-on-surface-variant font-bold">Nível {f.level} • {f.xp} XP</p>
                      </div>
                    </button>
                    <button
                      onClick={() => removeSavedFriend(f.id)}
                      className="p-2 text-on-surface-variant/60 hover:text-on-surface transition-all flex-shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
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

        {/* Escolha do WOD/desafio fica escondida atrás de um toque — igual
            aos cards de WOD "falta treinar" — pra não pesar o card inteiro
            só de olhar pra ele. */}
        <button
          type="button"
          onClick={() => setDuelPanelOpen(o => !o)}
          className="w-full flex items-center justify-between gap-2 bg-surface-container-highest/50 rounded-2xl px-4 py-3 border border-outline-variant/10"
        >
          <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Desafiar com um WOD</span>
          <ChevronDown className={cn('w-4 h-4 text-on-surface-variant transition-transform flex-shrink-0', duelPanelOpen && 'rotate-180')} />
        </button>

        {duelPanelOpen && (
        <div className="flex flex-col gap-3">
              {myWodsToday.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  <p className="text-[9px] text-on-surface-variant font-black uppercase tracking-widest px-1">
                    Desafie com um WOD de hoje
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {myWodsToday.map(row => (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => selectDuelWod(row)}
                        className={cn(
                          'px-3 py-2 rounded-xl text-[11px] font-black uppercase italic tracking-wide transition-all border',
                          duelFromWodId === row.id
                            ? 'bg-secondary text-background border-secondary'
                            : 'bg-surface-container-highest text-on-surface-variant border-transparent hover:border-secondary/30'
                        )}
                      >
                        {row.wod_name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-[9px] text-on-surface-variant/70 font-bold uppercase tracking-widest px-1 leading-snug">
                  Poste um WOD hoje e ele aparece aqui para desafiar com um toque
                </p>
              )}
              {/* Escrever um WOD que não foi postado hoje continua possível,
                  mas fechado por padrão — o caminho normal é o chip acima. */}
              <button
                type="button"
                onClick={toggleFreeDuel}
                className="self-start text-[9px] font-black text-secondary uppercase tracking-widest px-1 hover:opacity-80 transition-opacity"
              >
                {showFreeDuel ? '← Usar um WOD de hoje' : '+ Escrever outro desafio'}
              </button>

              {showFreeDuel && (
                <>
                  <input
                    type="text"
                    placeholder="Nome do desafio (ex: 100 Burpees)"
                    value={duelName}
                    onChange={e => setDuelName(e.target.value)}
                    className="w-full bg-surface-container-highest rounded-2xl px-4 py-3 text-sm font-medium text-on-surface outline-none"
                  />
                  <select
                    value={duelType}
                    onChange={e => setDuelType(e.target.value)}
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
                  {(duelType === 'FOR TIME' || duelType === 'AMRAP') && (
                    <div className="flex flex-col gap-1">
                      <input
                        type="number"
                        inputMode="numeric"
                        placeholder={duelType === 'FOR TIME' ? 'Total de reps do desafio (ex: 150)' : 'Duração em minutos (ex: 20)'}
                        value={duelType === 'FOR TIME' ? duelTotalReps : duelTimeCapMinutes}
                        onChange={e => duelType === 'FOR TIME' ? setDuelTotalReps(e.target.value) : setDuelTimeCapMinutes(e.target.value)}
                        className="w-full bg-secondary/5 border border-secondary/20 rounded-2xl px-4 py-3 text-sm font-medium text-on-surface outline-none"
                      />
                      {/* AMRAP: o resultado vem em "rounds+reps" — com as reps de
                          um round completo dá pra virar total de reps (ritmo). */}
                      {duelType === 'AMRAP' && (
                        <input
                          type="number"
                          inputMode="numeric"
                          placeholder="Reps de um round completo (ex: 30)"
                          value={duelRepsPerRound}
                          onChange={e => setDuelRepsPerRound(e.target.value)}
                          className="w-full bg-secondary/5 border border-secondary/20 rounded-2xl px-4 py-3 text-sm font-medium text-on-surface outline-none"
                        />
                      )}
                      <p className="text-[9px] text-on-surface-variant font-bold uppercase tracking-widest px-1">
                        Opcional — libera o ritmo (reps/min) no resultado do duelo
                      </p>
                    </div>
                  )}
                </>
              )}

              <button
                onClick={handleCreateDuel}
                disabled={creatingDuel || friends.length === 0 || !duelName.trim()}
                className="w-full bg-secondary text-background py-4 rounded-2xl font-headline font-black text-sm uppercase italic shadow-lg flex items-center justify-center gap-2 disabled:opacity-40 hover:opacity-90 transition-all"
              >
                {creatingDuel
                  ? <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin" />
                  : <Swords className="w-5 h-5" />}
                {/* O botão é quem avisa o que falta — nada some da tela. */}
                {friends.length === 0
                  ? 'ADICIONE UM AMIGO'
                  : !duelName.trim()
                    ? 'ESCOLHA O WOD'
                    : friends.length > 1 ? `ENVIAR DESAFIO (${friends.length})` : 'ENVIAR DESAFIO'}
              </button>
        </div>
        )}
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

      {/* Histórico do individual foi pro Perfil (junto do resto do progresso) —
          a página inicial fica focada no que fazer hoje. Box continua igual. */}
      {!isIndividual && (
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
                            : [log.wod_type, log.result, log.load_kg ? `${log.load_kg}kg` : null].filter(Boolean).join(' • ') || 'Anotação'}
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
      )}

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
          onClose={() => { setShowTimer(false); setWodToTrain(null); }}
          onFinish={handleTimerFinish}
          userId={user?.id}
          initialTitle={wodToTrain?.wod_name}
          initialType={wodToTrain && TIMER_TYPES.includes(wodToTrain.wod_type as WodTimerType)
            ? (wodToTrain.wod_type as WodTimerType) : undefined}
          initialDescription={wodToTrain?.description || undefined}
          initialMinutes={wodToTrain?.time_cap_minutes ?? undefined}
        />
      )}
    </div>
  );
}
