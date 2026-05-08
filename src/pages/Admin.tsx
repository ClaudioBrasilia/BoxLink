import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Users, MapPin, Calendar, Megaphone, Plus, Settings, 
  ChevronRight, ChevronDown, Activity, Check, X, Shield, UserPlus, 
  ImageIcon, ShoppingBag, Tv, Trophy, History, Search, Filter,
  Clock, ToggleLeft, ToggleRight, Trash2, Edit2, Save, Camera, Upload, Loader2, SlidersHorizontal
} from 'lucide-react';
import { cn } from '../lib/utils';
import { User, BoxSettings, Schedule, Item, Duel, Wod, VisitorPermissions } from '../types';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { supabase } from '../lib/supabase';
import { uploadImage } from '../utils/image';
import { createNotification } from '../hooks/useNotifications';
import { uploadAvatarItem } from '../utils/avatarUpload';
import type { AvatarSlotKey } from '../lib/avatarLayers';
import { LayerAdjustment, SLOT_DEFAULTS, resolveAdjustment, adjustmentToCSS } from '../lib/avatarLayers';

// ─── Calibrador inline ────────────────────────────────────────────────────────

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const AVATAR_BUCKET = 'avatar-assets';
function getAvatarUrl(filename: string) {
  // Se já for uma URL completa (vinda do Supabase após upload), usa direto
  if (filename.startsWith('http://') || filename.startsWith('https://')) {
    return filename;
  }
  const cleanFilename = /\.(png|jpg|jpeg|webp|gif)$/i.test(filename) ? filename : `${filename}.png`;
  return `${SUPABASE_URL}/storage/v1/object/public/${AVATAR_BUCKET}/${encodeURIComponent(cleanFilename)}`;
}

function SliderRow({ label, value, min, max, step, onChange, fmt }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; fmt?: (v: number) => string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between">
        <span className="text-[8px] font-bold uppercase tracking-widest text-on-surface-variant">{label}</span>
        <span className="text-[8px] font-black text-primary font-mono">{fmt ? fmt(value) : value.toFixed(1)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-1 rounded-full accent-primary cursor-pointer" />
    </div>
  );
}

interface CalibratorPanelProps {
  item: Item;
  onSave: (itemId: string, adj: Partial<LayerAdjustment>) => Promise<void>;
  onClose: () => void;
}

function CalibratorPanel({ item, onSave, onClose }: CalibratorPanelProps) {
  const slot = item.slot as AvatarSlotKey;
  const [adj, setAdj] = useState<LayerAdjustment>(resolveAdjustment(slot, item.layer_adjustment as any));
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof LayerAdjustment>(k: K, v: LayerAdjustment[K]) =>
    setAdj(prev => ({ ...prev, [k]: v }));

  const getDiff = (): Partial<LayerAdjustment> => {
    const def = SLOT_DEFAULTS[slot];
    const diff: Partial<LayerAdjustment> = {};
    for (const k of Object.keys(adj) as (keyof LayerAdjustment)[]) {
      if (adj[k] !== (def as any)[k]) (diff as any)[k] = adj[k];
    }
    return diff;
  };

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(item.id, getDiff()); } finally { setSaving(false); }
  };

  const baseStyle: React.CSSProperties = {
    position: 'absolute', inset: 0, width: '100%', height: '100%',
    objectFit: 'cover', objectPosition: 'top center', zIndex: 0,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
      className="fixed inset-x-0 bottom-0 z-50 bg-surface-container-low border-t border-outline-variant/20 rounded-t-3xl p-5 flex flex-col gap-4 shadow-2xl"
      style={{ maxHeight: '80vh', overflowY: 'auto' }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[7px] font-bold uppercase tracking-widest text-on-surface-variant opacity-50">🎯 Calibrando camada</p>
          <h4 className="text-sm font-headline font-black text-on-surface uppercase italic">{item.name}</h4>
        </div>
        <button onClick={onClose} className="p-2 rounded-xl bg-surface-container-highest text-on-surface-variant hover:text-on-surface transition-all">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Preview masc + fem lado a lado */}
      <div className="flex gap-3">
        {(['base masculina', 'base feminina'] as const).map(base => (
          <div key={base} className="flex-1 flex flex-col items-center gap-1">
            <div className="relative w-full aspect-[2/3] rounded-2xl overflow-hidden bg-surface-container-highest border border-outline-variant/10">
              <img src={getAvatarUrl(base)} alt="base" style={baseStyle} onError={e => { e.currentTarget.style.display = 'none'; }} />
              <img src={getAvatarUrl(item.image || item.id)} alt={item.name} style={adjustmentToCSS(adj)} onError={e => { e.currentTarget.style.opacity = '0.15'; }} />
            </div>
            <span className="text-[7px] font-bold uppercase tracking-widest text-on-surface-variant opacity-40">
              {base === 'base masculina' ? '♂' : '♀'}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <SliderRow label="Escala X" value={adj.scaleX} min={0.5} max={2} step={0.01} onChange={v => set('scaleX', v)} fmt={v => `${(v*100).toFixed(0)}%`} />
          <SliderRow label="Escala Y" value={adj.scaleY} min={0.5} max={2} step={0.01} onChange={v => set('scaleY', v)} fmt={v => `${(v*100).toFixed(0)}%`} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SliderRow label="Offset X" value={adj.offsetX} min={-50} max={50} step={0.5} onChange={v => set('offsetX', v)} fmt={v => `${v}%`} />
          <SliderRow label="Offset Y" value={adj.offsetY} min={-50} max={50} step={0.5} onChange={v => set('offsetY', v)} fmt={v => `${v}%`} />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[8px] font-bold uppercase tracking-widest text-on-surface-variant">Ancoragem</span>
          <div className="grid grid-cols-3 gap-1.5">
            {['top center', 'center center', 'bottom center'].map(pos => (
              <button key={pos} onClick={() => set('objectPosition', pos)}
                className={cn('py-1.5 rounded-xl text-[7px] font-bold uppercase tracking-widest border transition-all',
                  adj.objectPosition === pos ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container-highest text-on-surface-variant border-outline-variant/10')}>
                {pos === 'top center' ? 'Topo' : pos === 'center center' ? 'Centro' : 'Base'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setAdj(resolveAdjustment(slot, null))}
          className="px-4 py-2.5 rounded-xl bg-surface-container-highest text-on-surface-variant text-[8px] font-bold uppercase tracking-widest border border-outline-variant/10 transition-all">
          Resetar
        </button>
        <button onClick={handleSave} disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-on-primary text-[9px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 disabled:opacity-50 transition-all">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          {saving ? 'Salvando...' : 'Salvar Ajuste'}
        </button>
      </div>
    </motion.div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function Admin() {
  const toast = useToast();
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'settings' | 'schedule' | 'challenges' | 'store' | 'operation' | 'ranking' | 'checkins'>('users');
  const [settings, setSettings] = useState<BoxSettings>({
    name: '',
    logo: '',
    description: '',
    institutionalPhoto: '',
    topBanner: '',
    location: { lat: -15.7942, lng: -47.8822 },
    radius: 500,
    tvLayout: 'new',
    tvConfig: {
      showCheckins: true,
      showRanking: true,
      showDuels: true,
      showChallenges: true,
      rightBlockContent: 'ranking',
      topBlockContent: 'logo'
    },
    rewards: {
      xp_per_checkin: 20,
      coins_per_checkin: 5,
      weekly_bonus_3_xp: 50,
      weekly_bonus_3_coins: 10,
      weekly_bonus_4_xp: 100,
      weekly_bonus_4_coins: 20,
      weekly_bonus_5_xp: 150,
      weekly_bonus_5_coins: 30,
      weekly_bonus_6_xp: 200,
      weekly_bonus_6_coins: 40,
      level_up_bonus_coins: 50,
      challenge_easy_xp: 50,
      challenge_easy_coins: 10,
      challenge_medium_xp: 100,
      challenge_medium_coins: 20,
      challenge_hard_xp: 200,
      challenge_hard_coins: 40,
      challenge_special_xp: 500,
      challenge_special_coins: 100,
      duel_win_xp: 40,
      duel_win_coins: 10
    },
    isActive: true,
    announcements: [] as any[],
    timezone: 'America/Sao_Paulo',
    modules: {
      economy: true,
      store: true,
      duels: true,
      challenges: true,
      clans: true
    },
    max_clan_members: 10
  });
  const [selectedRoles, setSelectedRoles] = useState<Record<string, string>>({});
  const [schedule, setSchedule] = useState<Schedule[]>([]);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [duels, setDuels] = useState<Duel[]>([]);
  const [wods, setWods] = useState<Wod[]>([]);
  const [editingWod, setEditingWod] = useState<Wod | null>(null);
  const [clans, setClans] = useState<any[]>([]);
  const [clanMemberships, setClanMemberships] = useState<any[]>([]);
  const [editingChallenge, setEditingChallenge] = useState<any | null>(null);
  const [isEditingChallenge, setIsEditingChallenge] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [uploading, setUploading] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [checkinsDate, setCheckinsDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [checkinsExpanded, setCheckinsExpanded] = useState<Record<string, boolean>>({});

  // ── Calibrador ──
  const [calibratingItem, setCalibratingItem] = useState<Item | null>(null);

  const [newChallenge, setNewChallenge] = useState({
    title: '',
    description: '',
    active: true,
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(new Date().setDate(new Date().getDate() + 7)), 'yyyy-MM-dd'),
    xp: 50,
    coins: 10,
    repeatable: false,
    dailyLimit: 1,
    difficulty: 'easy',
    required_days: 1,
    require_photo: false
  });
  
  const [newSchedule, setNewSchedule] = useState<Schedule>({ 
    time: '', 
    endTime: '', 
    coach: '', 
    capacity: 20,
    days: [1,2,3,4,5],
    isActive: true,
    checkinWindowMinutes: 60
  });

  const [newItem, setNewItem] = useState<Item>({
    id: '',
    name: '',
    slot: 'top',
    price: 100,
    image: ''
  });
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  const [isManageUsersOpen, setIsManageUsersOpen] = useState(false);
  const [openSections, setOpenSections] = useState<string[]>([]);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  // ── Comunicados ──
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [isVisitorPanelOpen, setIsVisitorPanelOpen] = useState(false);
  const [visitorPermissions, setVisitorPermissions] = useState<VisitorPermissions>({
    wod: 'allowed',
    leaderboard: 'blocked',
    challenges: 'blocked',
    clans: 'blocked',
    feed: 'allowed',
    mybox: 'allowed',
    benchmarks: 'blocked',
    duels: 'blocked',
    progress: 'blocked',
    avatar: 'blocked',
  });

  const toggleSection = (section: string) => {
    setOpenSections(prev => 
      prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
    );
  };

  const fetchAll = async () => {
    const { data: usersData } = await supabase.from('profiles').select('*');
    const { data: allCheckins } = await supabase.from('checkins').select('*');
    if (usersData) {
      const mappedUsers = usersData.map((u: any) => ({
        id: u.id,
        email: u.email || '',
        name: u.name || 'Sem Nome',
        role: u.role || 'athlete',
        status: u.status || 'pending',
        xp: u.xp || 0,
        coins: u.coins || 0,
        level: u.level || 1,
        avatar: {
          equipped: u.avatar_equipped,
          inventory: u.avatar_inventory || []
        },
        checkins: (allCheckins || []).filter((c: any) => c.user_id === u.id).map((c: any) => ({
          date: c.date,
          timestamp: c.timestamp,
          classTime: c.class_time
        })),
        paidBonuses: u.paid_bonuses || [],
        createdAt: u.created_at
      }));
      setUsers(mappedUsers);
      const roles: Record<string, string> = {};
      mappedUsers.forEach((u: User) => { roles[u.id] = u.role; });
      setSelectedRoles(roles);
    }

    const { data: settingsData } = await supabase.from('box_settings').select('*').maybeSingle();
    if (settingsData) {
      setSettings(prev => ({
        ...prev,
        ...settingsData,
        id: settingsData.id,
        institutionalPhoto: settingsData.institutional_photo,
        topBanner: settingsData.top_banner,
        location: { lat: settingsData.lat, lng: settingsData.lng },
        rewards: settingsData.rewards || prev.rewards,
        tvConfig: settingsData.tv_config || (prev as any).tvConfig || {},
        modules: settingsData.modules || prev.modules,
        announcements: (settingsData.announcements || prev.announcements || []) as any[],
        timezone: settingsData.timezone || prev.timezone,
        max_clan_members: settingsData.max_clan_members || 10
      }));
      if (settingsData.visitor_permissions) {
        setVisitorPermissions(settingsData.visitor_permissions);
      }
    }

    const { data: scheduleData } = await supabase.from('schedule').select('*').order('time', { ascending: true });
    if (scheduleData) {
      setSchedule(scheduleData.map((s: any) => ({
        id: s.id, time: s.time, endTime: s.end_time, coach: s.coach,
        capacity: s.capacity, days: s.days, isActive: s.is_active,
        checkinWindowMinutes: s.checkin_window_minutes
      })));
    }

    const { data: challengesData } = await supabase.from('challenges').select('*').order('created_at', { ascending: false });
    if (challengesData) setChallenges(challengesData);

    const { data: itemsData } = await supabase.from('items').select('*');
    if (itemsData) setItems(itemsData);

    const { data: duelsData } = await supabase.from('duels').select('*').order('created_at', { ascending: false });
    if (duelsData) setDuels(duelsData);

    const { data: wodsData } = await supabase.from('wods').select('*').order('date', { ascending: false });
    if (wodsData) setWods(wodsData);

    const { data: clansData } = await supabase.from('clans').select('*').eq('is_active', true);
    if (clansData) setClans(clansData);

    const { data: clanMembershipsData } = await supabase.from('clan_memberships').select('*');
    if (clanMembershipsData) setClanMemberships(clanMembershipsData);

  };

  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel('admin_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'challenges' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'duels' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wods' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'box_settings' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clans' }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleStatusChange = async (userId: string, status: string) => {
    const updateData: Record<string, any> = { status };
    if (status === 'approved') updateData.role = selectedRoles[userId] || 'athlete';
    const { error } = await supabase.from('profiles').update(updateData).eq('id', userId);
    if (!error) {
      setUsers(users.map(u => u.id === userId ? { ...u, status: status as any, ...(status === 'approved' ? { role: updateData.role as any } : {}) } : u));
    } else {
      toast.error('Erro ao atualizar status: ' + error.message);
    }
  };

  const handleRoleChange = (userId: string, role: string) => {
    setSelectedRoles(prev => ({ ...prev, [userId]: role }));
  };

  const handleRoleUpdate = async (userId: string) => {
    const role = selectedRoles[userId] || 'athlete';
    const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
    if (!error) {
      setUsers(users.map(u => u.id === userId ? { ...u, role: role as any } : u));
      toast.success('Cargo atualizado com sucesso!');
    } else {
      toast.error('Erro ao atualizar cargo: ' + error.message);
    }
  };

  const handleDeleteUser = async (userId: string) => { setDeletingUserId(userId); };

  const confirmDeleteUser = async (userId: string) => {
    const { error } = await supabase.from('profiles').delete().eq('id', userId);
    if (!error) {
      setUsers(users.filter(u => u.id !== userId));
      toast.success('Usuário excluído com sucesso!');
    } else {
      toast.error('Erro ao excluir usuário: ' + error.message);
    }
    setDeletingUserId(null);
  };

  const handleSaveVisitorPermissions = async () => {
    const { error } = await supabase.from('box_settings').update({ visitor_permissions: visitorPermissions }).eq('is_active', true);
    if (!error) toast.success('Permissões de visitante salvas!');
    else toast.error('Erro ao salvar permissões: ' + error.message);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'logo' | 'institutionalPhoto' | 'topBanner') => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(field);
    try {
      const fileName = `${field}_${Date.now()}.jpg`;
      const profile = field === 'topBanner' ? 'banner' : 'logo';
      const publicUrl = await uploadImage(file, 'box-assets', fileName, profile);
      setSettings(s => ({ ...s, [field]: publicUrl }));
    } catch (error: any) {
      toast.error('Erro ao fazer upload: ' + error.message);
    } finally {
      setUploading(null);
    }
  };

  // ── Upload de imagem de item (padronizado 512×768) ──
  const handleItemImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const id = editingItem?.id || newItem.id;
    const slot = (editingItem?.slot || newItem.slot) as AvatarSlotKey;
    if (!file) return;
    if (!id) { toast.error('Preencha o ID do item antes de fazer upload.'); return; }
    setUploading('item');
    try {
      const url = await uploadAvatarItem(file, id, slot);
      if (editingItem) setEditingItem({ ...editingItem, image: url });
      else setNewItem({ ...newItem, image: url });
      toast.success('Imagem enviada!');
    } catch (err: any) {
      toast.error('Erro no upload: ' + err.message);
    } finally {
      setUploading(null);
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;

    // Guarda IDs dos comunicados que já existiam antes de salvar
    const { data: prevData } = await supabase
      .from('box_settings')
      .select('announcements')
      .eq('is_active', true)
      .maybeSingle();
    const prevAnnouncementIds = new Set(
      ((prevData?.announcements as any[]) || []).map((a: any) => a.id)
    );

    const { data, error } = await supabase
      .from('box_settings')
      .update({
        name: settings.name,
        logo: settings.logo,
        description: settings.description,
        lat: settings.location?.lat,
        lng: settings.location?.lng,
        radius: settings.radius,
        is_active: settings.isActive,
        rewards: settings.rewards || {},
        tv_config: (settings as any).tvConfig || (settings as any).tv_config || {},
        modules: settings.modules || {},
        announcements: (settings as any).announcements || [],
        timezone: settings.timezone || 'America/Sao_Paulo',
        clans_enabled: (settings as any).clans_enabled || false,
        avatar_enabled: (settings as any).avatar_enabled || false,
        max_clan_members: settings.max_clan_members || 10,
        updated_at: new Date().toISOString()
      })
      .eq('is_active', true)
      .select()
      .maybeSingle();
    if (!error && data) {
      fetchAll();
      toast.success('Ajustes salvos com sucesso!');
      // Detecta comunicados novos (IDs que não existiam antes) e notifica todos
      const currentAnnouncements: any[] = (settings as any).announcements || [];
      const newAnnouncements = currentAnnouncements.filter(
        (a: any) => a.title && !prevAnnouncementIds.has(a.id)
      );
      if (newAnnouncements.length > 0) {
        const { data: allProfiles } = await supabase.from('profiles').select('id');
        if (allProfiles) {
          for (const ann of newAnnouncements) {
            for (const profile of allProfiles) {
              await createNotification(
                profile.id,
                'announcement',
                `📢 ${ann.title}`,
                ann.content || 'Novo comunicado do box. Confira no início!',
                { announcement_id: ann.id }
              );
            }
          }
        }
      }
    }
    else toast.error('Erro ao salvar ajustes: ' + (error?.message || 'Erro desconhecido'));
  };

  const handleAddSchedule = async () => {
    if (!newSchedule.time || !newSchedule.endTime || !newSchedule.coach) {
      toast.warning('Por favor, preencha todos os campos obrigatórios: Início, Fim e Coach.');
      return;
    }
    const { data, error } = await supabase.from('schedule').insert({
      time: newSchedule.time, end_time: newSchedule.endTime, coach: newSchedule.coach,
      capacity: newSchedule.capacity, days: newSchedule.days, is_active: newSchedule.isActive,
      checkin_window_minutes: newSchedule.checkinWindowMinutes
    }).select();
    if (!error && data) {
      const added = data[0];
      setSchedule([...schedule, { id: added.id, time: added.time, endTime: added.end_time, coach: added.coach, capacity: added.capacity, days: added.days, isActive: added.is_active, checkinWindowMinutes: added.checkin_window_minutes }]);
      setNewSchedule({ time: '', endTime: '', coach: '', capacity: 20, days: [1,2,3,4,5], isActive: true, checkinWindowMinutes: 60 });
      toast.success('Horário adicionado com sucesso!');
    } else toast.error('Erro ao adicionar horário: ' + (error?.message || 'Erro desconhecido'));
  };

  const handleDeleteSchedule = async (id: string) => {
    const { error } = await supabase.from('schedule').delete().eq('id', id);
    if (!error) setSchedule(schedule.filter(s => s.id !== id));
    else toast.error('Erro ao excluir horário: ' + error.message);
  };

  const handleAddChallenge = async () => {
    if (!newChallenge.title || !newChallenge.description) return;
    const { data, error } = await supabase.from('challenges').insert({
      title: newChallenge.title, description: newChallenge.description, active: newChallenge.active,
      start_date: newChallenge.startDate, end_date: newChallenge.endDate,
      xp: newChallenge.xp, coins: newChallenge.coins, repeatable: newChallenge.repeatable,
      daily_limit: newChallenge.dailyLimit, difficulty: newChallenge.difficulty,
      required_days: newChallenge.required_days, require_photo: newChallenge.require_photo
    }).select();
    if (!error && data) {
      setChallenges([data[0], ...challenges]);
      setNewChallenge({ title: '', description: '', active: true, startDate: format(new Date(), 'yyyy-MM-dd'), endDate: format(new Date(new Date().setDate(new Date().getDate() + 7)), 'yyyy-MM-dd'), xp: 50, coins: 10, repeatable: false, dailyLimit: 1, difficulty: 'easy', required_days: 1, require_photo: false });
      toast.success('Desafio criado com sucesso!');
      // Notifica todos os usuários sobre o novo desafio
      for (const u of users) {
        await createNotification(
          u.id,
          'challenge_new',
          '⚡ Novo Desafio Disponível!',
          `"${newChallenge.title}" está disponível — complete e ganhe +${newChallenge.xp} XP e +${newChallenge.coins} BC!`,
          { challenge_id: data[0].id }
        );
      }
    } else toast.error('Erro ao criar desafio: ' + (error?.message || 'Erro desconhecido'));
  };

  const handleAddItem = async () => {
    if (!newItem.id || !newItem.name || !newItem.price) return;
    const { data, error } = await supabase.from('items').insert({
      id: newItem.id, name: newItem.name, slot: newItem.slot, price: newItem.price, image: newItem.image
    }).select();
    if (!error && data) {
      setItems([data[0], ...items]);
      setNewItem({ id: '', name: '', slot: 'top', price: 100, image: '' });
      toast.success('Item adicionado!');
    } else toast.error('Erro ao adicionar item: ' + (error?.message || 'Erro desconhecido'));
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este item?')) return;
    const { error } = await supabase.from('items').delete().eq('id', id);
    if (!error) setItems(items.filter(i => i.id !== id));
    else toast.error('Erro ao excluir item: ' + error.message);
  };

  const handleUpdateItem = async () => {
    if (!editingItem) return;
    const { error } = await supabase.from('items').update({
      name: editingItem.name, slot: editingItem.slot, price: editingItem.price, image: editingItem.image
    }).eq('id', editingItem.id);
    if (!error) {
      setItems(items.map(i => i.id === editingItem.id ? editingItem : i));
      setEditingItem(null);
      toast.success('Item atualizado com sucesso!');
    } else toast.error('Erro ao atualizar item: ' + error.message);
  };

  // ── Salva ajuste de camada no banco ──
  const handleSaveLayerAdjustment = async (itemId: string, adjustment: Partial<LayerAdjustment>) => {
    const { error } = await supabase.from('items').update({ layer_adjustment: adjustment }).eq('id', itemId);
    if (error) { toast.error('Erro ao salvar ajuste.'); return; }
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, layer_adjustment: adjustment as any } : i));
    if (calibratingItem?.id === itemId) setCalibratingItem(prev => prev ? { ...prev, layer_adjustment: adjustment as any } : null);
    setCalibratingItem(null);
    toast.success('Ajuste de camada salvo!');
  };

  const handleEditChallenge = (challenge: any) => {
    setEditingChallenge({ ...challenge, startDate: challenge.start_date, endDate: challenge.end_date });
    setIsEditingChallenge(true);
  };

  const handleUpdateChallenge = async () => {
    if (!editingChallenge || !editingChallenge.title || !editingChallenge.description) return;
    const { error } = await supabase.from('challenges').update({
      title: editingChallenge.title, description: editingChallenge.description, active: editingChallenge.active,
      start_date: editingChallenge.startDate, end_date: editingChallenge.endDate,
      xp: editingChallenge.xp, coins: editingChallenge.coins, repeatable: editingChallenge.repeatable,
      daily_limit: editingChallenge.dailyLimit, difficulty: editingChallenge.difficulty,
      required_days: editingChallenge.required_days, require_photo: editingChallenge.require_photo
    }).eq('id', editingChallenge.id);
    if (!error) {
      setChallenges(challenges.map(c => c.id === editingChallenge.id ? editingChallenge : c));
      setEditingChallenge(null); setIsEditingChallenge(false);
      toast.success('Desafio atualizado com sucesso!');
    } else toast.error('Erro ao atualizar desafio: ' + error.message);
  };

  const handleDeleteChallenge = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este desafio permanentemente?\n\nO histórico de recompensas vinculado também será removido.')) return;
    await supabase.from('reward_history').delete().eq('challenge_id', id);
    const { error } = await supabase.from('challenges').delete().eq('id', id);
    if (!error) { setChallenges(challenges.filter(c => c.id !== id)); toast.success('Desafio excluído com sucesso!'); }
    else toast.error('Erro ao excluir desafio: ' + error.message);
  };

  const handleDeleteClan = async (clanId: string) => {
    if (!confirm('Tem certeza que deseja excluir este time permanentemente?')) return;
    const { error } = await supabase.from('clans').delete().eq('id', clanId);
    if (!error) { toast.success('Time excluído com sucesso!'); fetchAll(); }
    else toast.error('Erro ao excluir time: ' + error.message);
  };

  const handleSystemReset = async () => {
    const confirmation = prompt('AVISO CRÍTICO: Isso apagará check-ins, duelos, recompensas, resultados de WOD, membros de clans e zerará XP/Coins/Level de todos.\n\nBenchmarks (Personal Records) serão MANTIDOS.\n\nDigite RESETAR para confirmar:');
    if (confirmation !== 'RESETAR') return;
    try {
      toast.success('Resetando... aguarde.');
      await supabase.from('checkins').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('reward_history').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('wod_results').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('duels').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('domination_events').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('challenge_checkins').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('challenges').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('clan_memberships').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('clans').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('feed_comments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('feed_likes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('feed_posts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('profiles').update({ xp: 0, coins: 0, level: 1, paid_bonuses: [], avatar_inventory: [], avatar_equipped: null }).neq('id', '00000000-0000-0000-0000-000000000000');
      toast.success('Nova temporada iniciada! Tudo zerado — benchmarks preservados.');
      fetchAll();
    } catch (err: any) { toast.error('Erro durante o reset: ' + err.message); }
  };

  const handleUpdateWod = async () => {
    if (!editingWod) return;
    const { error } = await supabase.from('wods').update({
      name: editingWod.name, type: editingWod.type, warmup: editingWod.warmup,
      skill: editingWod.skill, rx: editingWod.rx, scaled: editingWod.scaled,
      beginner: editingWod.beginner, date: editingWod.date
    }).eq('id', editingWod.id);
    if (!error) { setWods(wods.map(w => w.id === editingWod.id ? editingWod : w)); setEditingWod(null); toast.success('WOD atualizado com sucesso!'); }
    else toast.error('Erro ao atualizar WOD: ' + error.message);
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || (u.email || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesStatus && matchesRole;
  });

  const pendingUsers = users.filter(u => {
    const matchesSearch = (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || (u.email || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole && u.status === 'pending';
  });

  const approvedUsers = filteredUsers.filter(u => u.status === 'approved');
  const rejectedUsers = filteredUsers.filter(u => u.status === 'rejected');

  const historicalFrequencyRanking = approvedUsers.map(u => {
    const periodCheckins = u.checkins.filter(c => {
      const checkinDate = new Date(c.date + 'T12:00:00');
      return checkinDate.getMonth() === selectedMonth && checkinDate.getFullYear() === selectedYear;
    });
    return { ...u, periodCount: periodCheckins.length };
  }).sort((a, b) => b.periodCount - a.periodCount);

  return (
    <div className="flex flex-col gap-6 p-4 pt-8 min-h-screen bg-background">
      <header className="flex justify-between items-center">
        <h1 className="text-3xl font-headline font-black text-on-surface tracking-tight uppercase italic flex items-center gap-3">
          <LayoutDashboard className="w-8 h-8 text-primary" />
          PAINEL ADMIN
        </h1>
      </header>

      {/* Tabs */}
      <div className="flex bg-surface-container-low p-1 rounded-2xl border border-outline-variant/10 overflow-x-auto no-scrollbar">
        {(['users', 'settings', 'schedule', 'challenges', 'store', 'operation', 'ranking', 'checkins'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={cn("flex-1 min-w-[100px] py-3 rounded-xl font-headline font-bold text-[10px] uppercase tracking-widest transition-all",
              activeTab === tab ? "bg-primary text-background shadow-lg" : "text-on-surface-variant hover:text-on-surface")}>
            {tab === 'users' ? 'USUÁRIOS' : tab === 'settings' ? 'BOX' : tab === 'schedule' ? 'GRADE' : tab === 'challenges' ? 'DESAFIOS' : tab === 'store' ? 'LOJA' : tab === 'operation' ? 'OPERAÇÃO' : tab === 'checkins' ? 'CHECK-INS' : 'RANKING'}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">

        {/* ── USUÁRIOS ── */}
        {activeTab === 'users' && (
          <motion.div key="users" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="flex flex-col gap-4">
            <div className="bg-surface-container-low p-4 rounded-3xl border border-outline-variant/10 space-y-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant" />
                <input type="text" placeholder="BUSCAR POR NOME OU EMAIL..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-surface-container-highest border-none rounded-2xl py-4 pl-12 pr-4 font-headline font-bold text-xs text-on-surface placeholder:text-on-surface-variant/50" />
              </div>
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-2 bg-surface-container-highest px-3 py-2 rounded-xl border border-outline-variant/10">
                  <Filter className="w-3 h-3 text-primary" />
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest focus:ring-0 p-0">
                    <option value="all">TODOS STATUS</option>
                    <option value="pending">PENDENTES</option>
                    <option value="approved">APROVADOS</option>
                    <option value="rejected">REJEITADOS</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 bg-surface-container-highest px-3 py-2 rounded-xl border border-outline-variant/10">
                  <Shield className="w-3 h-3 text-primary" />
                  <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest focus:ring-0 p-0">
                    <option value="all">TODAS FUNÇÕES</option>
                    <option value="athlete">ALUNOS</option>
                    <option value="coach">COACHES</option>
                    <option value="admin">ADMINS</option>
                    <option value="visitor">VISITANTES</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center mb-2">
              <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic">SOLICITAÇÕES</h3>
              <span className="bg-primary/20 text-primary text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">{pendingUsers.length} PENDENTES</span>
            </div>

            <div className="space-y-3">
              {pendingUsers.length > 0 ? pendingUsers.map((u) => (
                <div key={u.id} className="bg-surface-container-low p-4 rounded-3xl border border-outline-variant/10 flex flex-col gap-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface font-headline font-black text-xl">{(u.name || 'S')[0]}</div>
                      <div>
                        <p className="text-on-surface font-bold uppercase text-sm">{u.name}</p>
                        <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">{u.email}</p>
                        <div className="flex gap-2 mt-1">
                          <span className="bg-secondary/20 text-secondary text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">PENDENTE</span>
                          <span className="bg-surface-container-highest text-on-surface-variant text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">{u.role === 'admin' ? 'ADMIN' : u.role === 'coach' ? 'COACH' : 'ALUNO'}</span>
                        </div>
                        <div className="mt-3 flex flex-col gap-2">
                          <label className="text-[8px] text-on-surface-variant font-bold uppercase tracking-widest">DEFINIR CARGO:</label>
                          <div className="flex gap-2 flex-wrap">
                            {(['athlete', 'coach', 'admin', 'visitor'] as const).map((role) => (
                              <button key={role} onClick={() => handleRoleChange(u.id, role)}
                                className={cn("px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all border",
                                  selectedRoles[u.id] === role ? "bg-primary text-background border-primary" : "bg-surface-container-highest text-on-surface-variant border-outline-variant/20")}>
                                {role === 'admin' ? 'ADMIN' : role === 'coach' ? 'COACH' : role === 'visitor' ? 'VISITANTE' : 'ALUNO'}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 self-end sm:self-start">
                      <button onClick={() => handleStatusChange(u.id, 'approved')} className="p-2 bg-primary/20 text-primary rounded-xl hover:bg-primary hover:text-background transition-all"><Check className="w-5 h-5" /></button>
                      <button onClick={() => handleStatusChange(u.id, 'rejected')} className="p-2 bg-error-container text-on-error-container rounded-xl hover:bg-error hover:text-on-error transition-all"><X className="w-5 h-5" /></button>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="bg-surface-container-low p-8 rounded-3xl border border-outline-variant/10 text-center">
                  <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest opacity-50 italic">Nenhuma solicitação pendente</p>
                </div>
              )}
            </div>

            <div className="mt-6">
              <button onClick={() => setIsManageUsersOpen(!isManageUsersOpen)}
                className="w-full flex justify-between items-center bg-surface-container-low p-6 rounded-3xl border border-outline-variant/10 group hover:border-primary/30 transition-all">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-xl transition-colors", isManageUsersOpen ? "bg-primary/20 text-primary" : "bg-surface-container-highest text-on-surface-variant")}>
                    <Users className="w-5 h-5" />
                  </div>
                  <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic">GERENCIAR USUÁRIOS</h3>
                </div>
                <div className="flex items-center gap-3">
                  <span className="bg-surface-container-highest text-on-surface-variant text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">{approvedUsers.length} ATIVOS</span>
                  <ChevronDown className={cn("w-5 h-5 text-on-surface-variant transition-transform", isManageUsersOpen && "rotate-180")} />
                </div>
              </button>
              <AnimatePresence>
                {isManageUsersOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="pt-4 space-y-3">
                      {approvedUsers.length > 0 ? approvedUsers.map((u) => (
                        <div key={u.id} className="bg-surface-container-low p-4 rounded-3xl border border-outline-variant/10 flex flex-col gap-4">
                          {deletingUserId === u.id && (
                            <div className="bg-error-container/20 border border-error/30 rounded-2xl p-4 flex flex-col gap-3">
                              <p className="text-[10px] font-black uppercase tracking-widest text-on-surface">⚠️ Confirmar exclusão de <span className="text-error">{u.name}</span>?</p>
                              <p className="text-[9px] text-on-surface-variant uppercase tracking-widest">Esta ação não pode ser desfeita.</p>
                              <div className="flex gap-2">
                                <button onClick={() => setDeletingUserId(null)} className="flex-1 py-2 rounded-xl bg-surface-container-highest text-on-surface text-[9px] font-black uppercase tracking-widest">CANCELAR</button>
                                <button onClick={() => confirmDeleteUser(u.id)} className="flex-1 py-2 rounded-xl bg-error text-on-error text-[9px] font-black uppercase tracking-widest">EXCLUIR</button>
                              </div>
                            </div>
                          )}
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-4">
                              <div className={cn("w-12 h-12 rounded-full flex items-center justify-center font-headline font-black text-xl", u.role === 'visitor' ? "bg-secondary/10 text-secondary" : "bg-primary/10 text-primary")}>{(u.name || 'S')[0]}</div>
                              <div>
                                <p className="text-on-surface font-bold uppercase text-sm">{u.name}</p>
                                <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">{u.email}</p>
                                <div className="mt-3 flex flex-col gap-2">
                                  <label className="text-[8px] text-on-surface-variant font-bold uppercase tracking-widest">ALTERAR CARGO:</label>
                                  <div className="flex gap-2 flex-wrap">
                                    {(['athlete', 'coach', 'admin', 'visitor'] as const).map((role) => (
                                      <button key={role} onClick={() => handleRoleChange(u.id, role)}
                                        className={cn("px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all border",
                                          selectedRoles[u.id] === role ? "bg-primary text-background border-primary" : "bg-surface-container-highest text-on-surface-variant border-outline-variant/20")}>
                                        {role === 'admin' ? 'ADMIN' : role === 'coach' ? 'COACH' : role === 'visitor' ? 'VISITANTE' : 'ALUNO'}
                                      </button>
                                    ))}
                                    {selectedRoles[u.id] !== u.role && (
                                      <button onClick={() => handleRoleUpdate(u.id)} className="px-3 py-1 bg-secondary text-background rounded-lg text-[8px] font-black uppercase tracking-widest animate-pulse">SALVAR</button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <span className={cn("text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest", u.role === 'visitor' ? "bg-secondary/20 text-secondary" : "bg-primary/20 text-primary")}>
                                {u.role === 'visitor' ? 'VISITANTE' : u.role === 'admin' ? 'ADMIN' : u.role === 'coach' ? 'COACH' : 'ATIVO'}
                              </span>
                              <button onClick={() => handleDeleteUser(u.id)} className="p-1.5 rounded-xl bg-error-container/30 text-error hover:bg-error hover:text-on-error transition-all"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </div>
                        </div>
                      )) : (
                        <div className="bg-surface-container-low p-8 rounded-3xl border border-outline-variant/10 text-center">
                          <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest opacity-50 italic">Nenhum usuário encontrado</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {rejectedUsers.length > 0 && (
              <div className="mt-6 space-y-3">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic">REJEITADOS</h3>
                  <span className="bg-error-container text-on-error-container text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">{rejectedUsers.length}</span>
                </div>
                {rejectedUsers.map((u) => (
                  <div key={u.id} className="bg-surface-container-low p-4 rounded-3xl border border-outline-variant/10 flex justify-between items-center opacity-60 grayscale">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface-variant font-headline font-black text-lg">{(u.name || 'S')[0]}</div>
                      <div>
                        <p className="text-on-surface font-bold uppercase text-xs">{u.name}</p>
                        <p className="text-on-surface-variant text-[8px] font-bold uppercase tracking-widest">{u.email}</p>
                      </div>
                    </div>
                    <button onClick={() => handleStatusChange(u.id, 'pending')} className="text-[8px] font-black text-primary uppercase tracking-widest hover:underline">RECONSIDERAR</button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6">
              <button onClick={() => setIsVisitorPanelOpen(!isVisitorPanelOpen)}
                className="w-full flex justify-between items-center bg-surface-container-low p-6 rounded-3xl border border-outline-variant/10 group hover:border-secondary/30 transition-all">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-xl transition-colors", isVisitorPanelOpen ? "bg-secondary/20 text-secondary" : "bg-surface-container-highest text-on-surface-variant")}><Shield className="w-5 h-5" /></div>
                  <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic">ACESSO VISITANTE</h3>
                </div>
                <ChevronDown className={cn("w-5 h-5 text-on-surface-variant transition-transform", isVisitorPanelOpen && "rotate-180")} />
              </button>
              <AnimatePresence>
                {isVisitorPanelOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="pt-4 space-y-3">
                      <div className="flex justify-between items-center px-1">
                        <p className="text-[9px] text-on-surface-variant font-bold uppercase tracking-widest opacity-60">Escolha o acesso de cada página</p>
                        <button onClick={handleSaveVisitorPermissions} className="bg-primary text-background px-4 py-2 rounded-xl font-headline font-black text-[9px] uppercase italic shadow-lg hover:scale-105 transition-transform flex items-center gap-1.5">
                          <Save className="w-3 h-3" /> SALVAR
                        </button>
                      </div>
                      <div className="flex justify-end gap-1 pr-1">
                        <span className="w-8 text-center text-[7px] font-black uppercase tracking-widest text-primary">VER</span>
                        <span className="w-8 text-center text-[7px] font-black uppercase tracking-widest text-error">BLOQ</span>
                        <span className="w-8 text-center text-[7px] font-black uppercase tracking-widest text-on-surface-variant">OCU</span>
                      </div>
                      {([
                        { key: 'feed', label: 'Feed / Novidades', icon: '📰' },
                        { key: 'wod', label: 'WOD do Dia', icon: '🏋️' },
                        { key: 'leaderboard', label: 'Ranking', icon: '🏆' },
                        { key: 'challenges', label: 'Desafios', icon: '⚡' },
                        { key: 'clans', label: 'Clans', icon: '🛡️' },
                        { key: 'mybox', label: 'Meu Box', icon: '📍' },
                        { key: 'benchmarks', label: 'Benchmarks', icon: '📊' },
                        { key: 'duels', label: 'Duelos', icon: '⚔️' },
                        { key: 'progress', label: 'Progresso', icon: '📈' },
                        { key: 'avatar', label: 'Avatar / Loja', icon: '🎮' },
                      ] as { key: keyof VisitorPermissions; label: string; icon: string }[]).map(({ key, label, icon }) => (
                        <div key={key} className="flex items-center gap-3 bg-surface-container-low p-4 rounded-3xl border border-outline-variant/10">
                          <span className="text-base flex-shrink-0">{icon}</span>
                          <p className="text-[10px] text-on-surface font-bold uppercase tracking-widest flex-1 min-w-0 truncate">{label}</p>
                          <div className="flex gap-1 flex-shrink-0">
                            {(['allowed', 'blocked', 'hidden'] as const).map((val) => (
                              <button key={val} onClick={() => setVisitorPermissions(prev => ({ ...prev, [key]: val }))}
                                className={cn("w-8 h-8 rounded-xl text-[10px] font-black transition-all border",
                                  visitorPermissions[key] === val
                                    ? val === 'allowed' ? "bg-primary text-background border-primary" : val === 'blocked' ? "bg-error text-white border-error" : "bg-surface-container-highest text-on-surface-variant border-outline-variant/50"
                                    : "bg-surface-container-highest text-on-surface-variant/30 border-outline-variant/10")}>
                                {val === 'allowed' ? '✓' : val === 'blocked' ? '✕' : '–'}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {/* ── SETTINGS ── (idêntico ao original) */}
        {activeTab === 'settings' && (
          <motion.div key="settings" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="flex flex-col gap-6">
            <div className="bg-surface-container-low p-6 rounded-[2rem] border border-outline-variant/10 space-y-8">
              <div className="flex justify-between items-center">
                <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic">CONFIGURAÇÕES DO BOX</h3>
                <button onClick={handleSaveSettings} className="bg-primary text-background px-6 py-2 rounded-xl font-headline font-black text-xs uppercase italic shadow-lg hover:scale-105 transition-transform flex items-center gap-2">
                  <Save className="w-4 h-4" /> SALVAR ALTERAÇÕES
                </button>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-primary"><Settings className="w-4 h-4" /><span className="text-[10px] font-black uppercase tracking-widest">Informações Básicas</span></div>
                <div className="space-y-2"><label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Nome do Box</label><input type="text" value={settings.name} onChange={e => setSettings({...settings, name: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" /></div>
                <div className="space-y-2"><label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Descrição</label><textarea value={settings.description} onChange={e => setSettings({...settings, description: e.target.value})} rows={3} className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface resize-none" /></div>
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Raio de Check-in (metros)</label>
                  <input type="number" min={50} max={5000} value={settings.radius} onChange={e => setSettings({...settings, radius: parseInt(e.target.value) || 500})} className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" />
                  <p className="text-[9px] text-on-surface-variant opacity-50 uppercase tracking-widest">Distância máxima do box para fazer check-in. Padrão: 500m</p>
                </div>
              </div>
              <div className="space-y-4 border-t border-outline-variant/10 pt-6">
                <div className="flex items-center gap-2 text-primary"><ImageIcon className="w-4 h-4" /><span className="text-[10px] font-black uppercase tracking-widest">Imagens e Identidade</span></div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {(['logo', 'institutionalPhoto', 'topBanner'] as const).map(field => (
                    <div key={field} className="space-y-3">
                      <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">{field === 'logo' ? 'Logo do Box' : field === 'institutionalPhoto' ? 'Foto Institucional' : 'Banner Superior'}</label>
                      <div className="relative group aspect-square rounded-3xl bg-surface-container-highest overflow-hidden border-2 border-dashed border-outline-variant/20 flex items-center justify-center">
                        {(settings as any)[field] ? <img src={(settings as any)[field]} alt={field} className="w-full h-full object-contain p-4" /> : <ImageIcon className="w-8 h-8 text-on-surface-variant/30" />}
                        <label className="absolute inset-0 flex items-center justify-center bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                          <input type="file" className="hidden" onChange={e => handleFileUpload(e, field)} accept="image/*" />
                          <div className="flex flex-col items-center gap-2"><Camera className="w-6 h-6 text-primary" /><span className="text-[8px] font-black text-on-surface uppercase tracking-widest">ALTERAR</span></div>
                        </label>
                        {uploading === field && <div className="absolute inset-0 bg-background/60 flex items-center justify-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* ── Recompensas Padrão ── */}
              <div className="space-y-4 border-t border-outline-variant/10 pt-6">
                <button onClick={() => toggleSection('rewards')} className="w-full flex justify-between items-center p-4 bg-surface-container-low rounded-2xl border border-outline-variant/10">
                  <h3 className="font-headline font-bold text-sm text-on-surface uppercase italic">RECOMPENSAS PADRÃO</h3>
                  {openSections.includes('rewards') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                <AnimatePresence>
                  {openSections.includes('rewards') && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden px-2 space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">XP por Check-in</label>
                          <input type="number" value={settings.rewards.xp_per_checkin} onChange={e => { const val = e.target.value === '' ? 0 : parseInt(e.target.value); setSettings(s => ({...s, rewards: {...s.rewards, xp_per_checkin: val}})); }} className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">BrazaCoins por Check-in</label>
                          <input type="number" value={settings.rewards.coins_per_checkin} onChange={e => { const val = e.target.value === '' ? 0 : parseInt(e.target.value); setSettings(s => ({...s, rewards: {...s.rewards, coins_per_checkin: val}})); }} className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ── Recompensas por Desafio ── */}
              <div className="space-y-4 border-t border-outline-variant/10 pt-6">
                <button onClick={() => toggleSection('challenges')} className="w-full flex justify-between items-center p-4 bg-surface-container-low rounded-2xl border border-outline-variant/10">
                  <h3 className="font-headline font-bold text-sm text-on-surface uppercase italic">RECOMPENSAS POR DESAFIO</h3>
                  {openSections.includes('challenges') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                <AnimatePresence>
                  {openSections.includes('challenges') && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden px-2 space-y-4">
                      {(['easy', 'medium', 'hard', 'special'] as const).map(diff => (
                        <div key={diff} className="p-4 bg-surface-container-highest/30 rounded-2xl border border-outline-variant/10 space-y-3">
                          <div className="text-[10px] text-primary font-black uppercase tracking-widest">DESAFIO {diff === 'easy' ? 'FÁCIL' : diff === 'medium' ? 'MÉDIO' : diff === 'hard' ? 'DIFÍCIL' : 'ESPECIAL'}</div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-[8px] text-on-surface-variant font-bold uppercase tracking-widest">XP</label>
                              <input type="number" value={(settings.rewards as any)[`challenge_${diff}_xp`]} onChange={e => { const val = e.target.value === '' ? 0 : parseInt(e.target.value); setSettings(s => ({...s, rewards: {...s.rewards, [`challenge_${diff}_xp`]: val}})); }} className="w-full bg-surface-container-highest border-none rounded-xl p-3 font-headline font-bold text-on-surface text-sm" />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[8px] text-on-surface-variant font-bold uppercase tracking-widest">BrazaCoins</label>
                              <input type="number" value={(settings.rewards as any)[`challenge_${diff}_coins`]} onChange={e => { const val = e.target.value === '' ? 0 : parseInt(e.target.value); setSettings(s => ({...s, rewards: {...s.rewards, [`challenge_${diff}_coins`]: val}})); }} className="w-full bg-surface-container-highest border-none rounded-xl p-3 font-headline font-bold text-on-surface text-sm" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ── Bônus Semanais ── */}
              <div className="space-y-4 border-t border-outline-variant/10 pt-6">
                <button onClick={() => toggleSection('weekly')} className="w-full flex justify-between items-center p-4 bg-surface-container-low rounded-2xl border border-outline-variant/10">
                  <h3 className="font-headline font-bold text-sm text-on-surface uppercase italic">BÔNUS SEMANAIS (FREQUÊNCIA)</h3>
                  {openSections.includes('weekly') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                <AnimatePresence>
                  {openSections.includes('weekly') && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden px-2 space-y-4">
                      {[3, 4, 5, 6].map(count => (
                        <div key={count} className="grid grid-cols-2 gap-4 p-4 bg-surface-container-highest/30 rounded-2xl border border-outline-variant/10">
                          <div className="col-span-2 text-[10px] text-primary font-black uppercase tracking-widest">{count} CHECK-INS NA SEMANA</div>
                          <div className="space-y-2">
                            <label className="text-[8px] text-on-surface-variant font-bold uppercase tracking-widest">XP Bônus</label>
                            <input type="number" value={(settings.rewards as any)[`weekly_bonus_${count}_xp`]} onChange={e => { const val = e.target.value === '' ? 0 : parseInt(e.target.value); setSettings(s => ({...s, rewards: {...s.rewards, [`weekly_bonus_${count}_xp`]: val}})); }} className="w-full bg-surface-container-highest border-none rounded-xl p-3 font-headline font-bold text-on-surface text-sm" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[8px] text-on-surface-variant font-bold uppercase tracking-widest">BrazaCoins Bônus</label>
                            <input type="number" value={(settings.rewards as any)[`weekly_bonus_${count}_coins`]} onChange={e => { const val = e.target.value === '' ? 0 : parseInt(e.target.value); setSettings(s => ({...s, rewards: {...s.rewards, [`weekly_bonus_${count}_coins`]: val}})); }} className="w-full bg-surface-container-highest border-none rounded-xl p-3 font-headline font-bold text-on-surface text-sm" />
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ── Outras Recompensas ── */}
              <div className="space-y-4 border-t border-outline-variant/10 pt-6">
                <button onClick={() => toggleSection('other')} className="w-full flex justify-between items-center p-4 bg-surface-container-low rounded-2xl border border-outline-variant/10">
                  <h3 className="font-headline font-bold text-sm text-on-surface uppercase italic">OUTRAS RECOMPENSAS</h3>
                  {openSections.includes('other') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                <AnimatePresence>
                  {openSections.includes('other') && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden px-2 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">BrazaCoins por Level Up</label>
                          <input type="number" value={settings.rewards.level_up_bonus_coins} onChange={e => { const val = e.target.value === '' ? 0 : parseInt(e.target.value); setSettings(s => ({...s, rewards: {...s.rewards, level_up_bonus_coins: val}})); }} className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">XP por Derrota em Duelo</label>
                          <input type="number" value={(settings.rewards as any).duel_loss_xp || 0} onChange={e => { const val = e.target.value === '' ? 0 : parseInt(e.target.value); setSettings(s => ({...s, rewards: {...s.rewards, duel_loss_xp: val}})); }} className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ── Avisos do Box ── */}
              <div className="space-y-4 border-t border-outline-variant/10 pt-6">
                <button onClick={() => toggleSection('announcements')} className="w-full flex justify-between items-center p-4 bg-surface-container-low rounded-2xl border border-outline-variant/10">
                  <h3 className="font-headline font-bold text-sm text-on-surface uppercase italic">AVISOS DO BOX</h3>
                  {openSections.includes('announcements') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                <AnimatePresence>
                  {openSections.includes('announcements') && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden px-2 space-y-4">
                      <button onClick={() => setSettings(s => ({...s, announcements: [...s.announcements, { id: Date.now().toString(), title: '', content: '', date: new Date().toISOString(), active: true }]}))} className="w-full py-3 border-2 border-dashed border-outline-variant/20 rounded-2xl text-[10px] font-black text-on-surface-variant uppercase tracking-widest hover:border-primary/30 hover:text-primary transition-all flex items-center justify-center gap-2">
                        <Plus className="w-4 h-4" /> ADICIONAR NOVO AVISO
                      </button>
                      {settings.announcements.map((ann: any, idx: number) => (
                        <div key={ann.id} className="p-4 bg-surface-container-highest/30 rounded-2xl border border-outline-variant/10 space-y-4">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-primary font-black uppercase tracking-widest">AVISO #{idx + 1}</span>
                            <button onClick={() => setSettings(s => ({...s, announcements: s.announcements.filter((a: any) => a.id !== ann.id)}))} className="text-error hover:scale-110 transition-transform"><Trash2 className="w-4 h-4" /></button>
                          </div>
                          <input type="text" placeholder="TÍTULO DO AVISO" value={ann.title} onChange={e => { const newAnn = [...settings.announcements]; (newAnn[idx] as any).title = e.target.value; setSettings({...settings, announcements: newAnn}); }} className="w-full bg-surface-container-highest border-none rounded-xl p-3 font-headline font-bold text-on-surface text-sm" />
                          <textarea placeholder="CONTEÚDO DO AVISO" value={ann.content} onChange={e => { const newAnn = [...settings.announcements]; (newAnn[idx] as any).content = e.target.value; setSettings({...settings, announcements: newAnn}); }} rows={2} className="w-full bg-surface-container-highest border-none rounded-xl p-3 font-headline font-bold text-on-surface text-xs resize-none" />
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ── Módulo Economia ── */}
              <div className="flex items-center justify-between p-4 bg-surface-container-highest rounded-2xl">
                <div><p className="text-xs font-black text-on-surface uppercase italic">Módulo Economia</p><p className="text-[10px] text-on-surface-variant mt-0.5">Ativa/desativa sistema de moedas e XP</p></div>
                <button onClick={() => setSettings({...settings, modules: {...settings.modules, economy: !settings.modules.economy}})} className={`w-12 h-6 rounded-full transition-all relative ${settings.modules.economy ? 'bg-primary' : 'bg-surface-container-highest border border-outline-variant/30'}`}>
                  <div className={`w-5 h-5 rounded-full bg-white shadow transition-all absolute top-0.5 ${settings.modules.economy ? 'right-0.5' : 'left-0.5'}`} />
                </button>
              </div>

              {/* ── Módulo Loja ── */}
              <div className="flex items-center justify-between p-4 bg-surface-container-highest rounded-2xl">
                <div><p className="text-xs font-black text-on-surface uppercase italic">Módulo Loja</p><p className="text-[10px] text-on-surface-variant mt-0.5">Ativa/desativa loja de avatares para atletas</p></div>
                <button onClick={() => setSettings({...settings, modules: {...settings.modules, store: !settings.modules.store}})} className={`w-12 h-6 rounded-full transition-all relative ${settings.modules.store ? 'bg-primary' : 'bg-surface-container-highest border border-outline-variant/30'}`}>
                  <div className={`w-5 h-5 rounded-full bg-white shadow transition-all absolute top-0.5 ${settings.modules.store ? 'right-0.5' : 'left-0.5'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-surface-container-highest rounded-2xl">
                <div><p className="text-xs font-black text-on-surface uppercase italic">Sistema de Times</p><p className="text-[10px] text-on-surface-variant mt-0.5">Ativa disputa por territórios entre times</p></div>
                <button onClick={() => setSettings({...settings, clans_enabled: !(settings as any).clans_enabled} as any)} className={`w-12 h-6 rounded-full transition-all relative ${(settings as any)?.clans_enabled ? 'bg-primary' : 'bg-surface-container-highest border border-outline-variant/30'}`}>
                  <div className={`w-5 h-5 rounded-full bg-white shadow transition-all absolute top-0.5 ${(settings as any)?.clans_enabled ? 'right-0.5' : 'left-0.5'}`} />
                </button>
              </div>
              <div className="flex items-center justify-between p-4 bg-surface-container-highest rounded-2xl">
                <div><p className="text-xs font-black text-on-surface uppercase italic">Sistema de Avatar</p><p className="text-[10px] text-on-surface-variant mt-0.5">Permite atletas customizar seu personagem na loja</p></div>
                <button onClick={() => setSettings({...settings, avatar_enabled: !(settings as any).avatar_enabled} as any)} className={`w-12 h-6 rounded-full transition-all relative ${(settings as any)?.avatar_enabled ? 'bg-primary' : 'bg-surface-container-highest border border-outline-variant/30'}`}>
                  <div className={`w-5 h-5 rounded-full bg-white shadow transition-all absolute top-0.5 ${(settings as any)?.avatar_enabled ? 'right-0.5' : 'left-0.5'}`} />
                </button>
              </div>
              <button onClick={handleSaveSettings} className="w-full bg-primary text-background py-4 rounded-2xl font-headline font-black text-lg uppercase italic shadow-lg hover:scale-[0.98] active:scale-95 transition-all flex items-center justify-center gap-2">
                <Save className="w-5 h-5" /> SALVAR AJUSTES
              </button>
            </div>
          </motion.div>
        )}

        {/* ── GRADE ── */}
        {activeTab === 'schedule' && (
          <motion.div key="schedule" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="flex flex-col gap-6">
            <div className="bg-surface-container-low p-6 rounded-[2rem] border border-outline-variant/10 space-y-4">
              <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic">ADICIONAR HORÁRIO</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Início</label><input type="time" value={newSchedule.time} onChange={e => setNewSchedule({...newSchedule, time: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" /></div>
                <div className="space-y-2"><label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Fim</label><input type="time" value={newSchedule.endTime} onChange={e => setNewSchedule({...newSchedule, endTime: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Coach</label>
                  <select value={newSchedule.coach} onChange={e => setNewSchedule({...newSchedule, coach: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface appearance-none cursor-pointer">
                    <option value="">Selecionar Coach</option>
                    {users.filter(u => u.role === 'coach' || u.role === 'admin').map(coach => (<option key={coach.id} value={coach.name}>{coach.name} ({coach.role === 'admin' ? 'Head' : 'Coach'})</option>))}
                  </select>
                </div>
                <div className="space-y-2"><label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Capacidade</label><input type="number" value={newSchedule.capacity} onChange={e => setNewSchedule({...newSchedule, capacity: parseInt(e.target.value) || 0})} className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" /></div>
              </div>
              <div className="space-y-2"><label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Janela de Check-in (min antes)</label><input type="number" value={newSchedule.checkinWindowMinutes} onChange={e => setNewSchedule({...newSchedule, checkinWindowMinutes: parseInt(e.target.value) || 0})} className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" /></div>
              <div className="space-y-2">
                <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Dias da Semana</label>
                <div className="flex gap-2 flex-wrap">
                  {['D','S','T','Q','Q','S','S'].map((day, idx) => (
                    <button key={idx} onClick={() => { const days = newSchedule.days || []; setNewSchedule({...newSchedule, days: days.includes(idx) ? days.filter(d => d !== idx) : [...days, idx]}); }}
                      className={cn("w-10 h-10 rounded-xl font-headline font-bold text-xs transition-all border", newSchedule.days?.includes(idx) ? "bg-primary text-background border-primary" : "bg-surface-container-highest text-on-surface-variant border-outline-variant/10")}>
                      {day}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={handleAddSchedule} className="w-full bg-primary text-background py-4 rounded-2xl font-headline font-black uppercase italic shadow-lg flex items-center justify-center gap-2"><Plus className="w-5 h-5" /> ADICIONAR HORÁRIO</button>
            </div>
            <div className="space-y-3">
              <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic">GRADE ATUAL</h3>
              {schedule.map((s) => (
                <div key={s.id} className="bg-surface-container-low p-4 rounded-3xl border border-outline-variant/10 flex justify-between items-center group hover:border-primary/30 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-2xl"><Clock className="w-6 h-6 text-primary" /></div>
                    <div>
                      <div className="flex items-center gap-2"><p className="text-on-surface font-bold uppercase text-sm italic">{s.time} - {s.endTime}</p>{!s.isActive && <span className="bg-error-container text-on-error-container text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">INATIVO</span>}</div>
                      <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">Coach: {s.coach} • Cap: {s.capacity}</p>
                      <div className="flex gap-1 mt-1">{['D','S','T','Q','Q','S','S'].map((day, idx) => (<span key={idx} className={cn("text-[8px] font-black w-4 h-4 flex items-center justify-center rounded-sm", s.days?.includes(idx) ? "bg-primary/20 text-primary" : "bg-surface-container-highest text-on-surface-variant opacity-30")}>{day}</span>))}</div>
                    </div>
                  </div>
                  <button onClick={() => s.id && handleDeleteSchedule(s.id)} className="p-2 text-on-surface-variant hover:text-error transition-colors flex-shrink-0"><Trash2 className="w-5 h-5" /></button>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── DESAFIOS ── */}
        {activeTab === 'challenges' && (
          <motion.div key="challenges" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="flex flex-col gap-6">
            <div className="bg-surface-container-low p-6 rounded-[2rem] border border-outline-variant/10 space-y-4">
              <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic">CRIAR NOVO DESAFIO</h3>
              <div className="space-y-2"><label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Título</label><input type="text" value={newChallenge.title} onChange={e => setNewChallenge({...newChallenge, title: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" /></div>
              <div className="space-y-2"><label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Descrição</label><textarea value={newChallenge.description} onChange={e => setNewChallenge({...newChallenge, description: e.target.value})} rows={3} className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface resize-none" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">XP</label><input type="number" value={newChallenge.xp} onChange={e => setNewChallenge({...newChallenge, xp: parseInt(e.target.value)})} className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" /></div>
                <div className="space-y-2"><label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Coins</label><input type="number" value={newChallenge.coins} onChange={e => setNewChallenge({...newChallenge, coins: parseInt(e.target.value)})} className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Dificuldade</label>
                  <select value={newChallenge.difficulty} onChange={e => setNewChallenge({...newChallenge, difficulty: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface appearance-none cursor-pointer">
                    <option value="easy">Fácil</option>
                    <option value="medium">Médio</option>
                    <option value="hard">Difícil</option>
                    <option value="special">Especial</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Dias necessários</label>
                  <input type="number" min={1} value={newChallenge.required_days} onChange={e => setNewChallenge({...newChallenge, required_days: parseInt(e.target.value) || 1})} className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Data Inicial</label>
                  <input type="date" style={{ colorScheme: 'dark' }} value={newChallenge.startDate} onChange={e => setNewChallenge({...newChallenge, startDate: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Data Final</label>
                  <input type="date" style={{ colorScheme: 'dark' }} value={newChallenge.endDate} onChange={e => setNewChallenge({...newChallenge, endDate: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" />
                </div>
              </div>
              <button
                onClick={() => setNewChallenge({...newChallenge, require_photo: !newChallenge.require_photo})}
                className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl border-2 transition-all font-headline font-bold text-sm uppercase italic ${newChallenge.require_photo ? 'bg-secondary/20 border-secondary text-secondary' : 'bg-surface-container-highest border-outline-variant/20 text-on-surface-variant'}`}
              >
                <span className="flex items-center gap-2"><Camera className="w-5 h-5" /> Exigir foto para completar</span>
                {newChallenge.require_photo ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
              </button>
              <button onClick={handleAddChallenge} className="w-full bg-primary text-background py-4 rounded-2xl font-headline font-black uppercase italic shadow-lg flex items-center justify-center gap-2"><Plus className="w-5 h-5" /> CRIAR DESAFIO</button>
            </div>
            <div className="space-y-3">
              <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic">DESAFIOS ATIVOS</h3>
              {challenges.map((c) => (
                <div key={c.id} className="bg-surface-container-low p-4 rounded-3xl border border-outline-variant/10 space-y-3 group relative">
                  <div className="flex justify-between items-start">
                    <div className="flex-1"><h4 className="text-on-surface font-bold uppercase text-sm italic">{c.title}</h4><p className="text-on-surface-variant text-[10px] mt-1">{c.description}</p></div>
                    <div className="flex gap-2 ml-2">
                      <button onClick={() => handleEditChallenge(c)} className="p-2 bg-primary/20 text-primary rounded-xl transition-all hover:bg-primary/30"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDeleteChallenge(c.id)} className="p-2 bg-error-container text-on-error-container rounded-xl transition-all hover:bg-error/30"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-outline-variant/10">
                    <div className="flex gap-3"><span className="text-[10px] font-black text-primary uppercase tracking-widest">{c.xp} XP</span><span className="text-[10px] font-black text-secondary uppercase tracking-widest">{c.coins} COINS</span></div>
                    <span className="text-[8px] text-on-surface-variant font-bold uppercase tracking-widest">{c.start_date ? format(new Date(c.start_date), 'dd/MM') : '—'} - {c.end_date ? format(new Date(c.end_date), 'dd/MM') : '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── LOJA ── com upload de imagem + calibrador ── */}
        {activeTab === 'store' && (
          <motion.div key="store" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="flex flex-col gap-6">
            <div className="bg-surface-container-low p-6 rounded-[2rem] border border-outline-variant/10 space-y-4">
              <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-primary" /> {editingItem ? 'EDITAR ITEM' : 'ADICIONAR ITEM NA LOJA'}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">ID do Item</label>
                  <input type="text" value={editingItem ? editingItem.id : newItem.id} onChange={e => editingItem ? setEditingItem({...editingItem, id: e.target.value}) : setNewItem({...newItem, id: e.target.value})}
                    disabled={!!editingItem} placeholder="ex: cap_red" className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface disabled:opacity-50" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Nome</label>
                  <input type="text" value={editingItem ? editingItem.name : newItem.name} onChange={e => editingItem ? setEditingItem({...editingItem, name: e.target.value}) : setNewItem({...newItem, name: e.target.value})}
                    placeholder="ex: Boné Vermelho" className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Slot</label>
                  <select value={editingItem ? editingItem.slot : newItem.slot} onChange={e => editingItem ? setEditingItem({...editingItem, slot: e.target.value as any}) : setNewItem({...newItem, slot: e.target.value as any})}
                    className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface appearance-none cursor-pointer">
                    <option value="top">Camiseta (top)</option>
                    <option value="bottom">Calça/Short (bottom)</option>
                    <option value="shoes">Tênis (shoes)</option>
                    <option value="accessory">Acessório</option>
                    <option value="head_accessory">Cabeça</option>
                    <option value="wrist_accessory">Pulso</option>
                    <option value="special">Especial</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Preço (Coins)</label>
                  <input type="number" value={editingItem ? editingItem.price : newItem.price} onChange={e => editingItem ? setEditingItem({...editingItem, price: parseInt(e.target.value)}) : setNewItem({...newItem, price: parseInt(e.target.value)})}
                    className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" />
                </div>
              </div>

              {/* ── Campo de imagem com upload padronizado ── */}
              <div className="space-y-2">
                <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Imagem do Item</label>
                <div className="flex gap-3 items-center">
                  {(editingItem?.image || newItem.image) && (
                    <img src={editingItem?.image || newItem.image} alt="preview" className="w-14 h-14 rounded-2xl object-contain bg-surface-container-highest flex-shrink-0" />
                  )}
                  <label className={cn(
                    'flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border text-[9px] font-bold uppercase tracking-widest cursor-pointer transition-all',
                    uploading === 'item' ? 'bg-surface-container-highest text-on-surface-variant border-outline-variant/10' : 'bg-surface-container-highest text-on-surface-variant border-outline-variant/10 hover:border-primary/40 hover:text-primary'
                  )}>
                    {uploading === 'item' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {uploading === 'item' ? 'Enviando...' : 'Selecionar imagem'}
                    <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={uploading === 'item'} onChange={handleItemImageUpload} />
                  </label>
                </div>
                <p className="text-[8px] text-on-surface-variant opacity-50 uppercase tracking-widest">
                  Preencha o ID antes de fazer upload · Imagem padronizada 512×768 automaticamente
                </p>
              </div>

              <div className="flex gap-2">
                {editingItem ? (
                  <>
                    <button onClick={handleUpdateItem} className="flex-1 bg-primary text-background py-4 rounded-2xl font-headline font-black uppercase italic shadow-lg flex items-center justify-center gap-2"><Save className="w-5 h-5" /> SALVAR ALTERAÇÕES</button>
                    <button onClick={() => setEditingItem(null)} className="flex-1 bg-surface-container-highest text-on-surface py-4 rounded-2xl font-headline font-black uppercase italic shadow-lg flex items-center justify-center gap-2"><X className="w-5 h-5" /> CANCELAR</button>
                  </>
                ) : (
                  <button onClick={handleAddItem} className="w-full bg-primary text-background py-4 rounded-2xl font-headline font-black uppercase italic shadow-lg flex items-center justify-center gap-2"><Plus className="w-5 h-5" /> ADICIONAR ITEM</button>
                )}
              </div>
            </div>

            {/* Grid de itens com botão calibrador */}
            <div className="grid grid-cols-2 gap-4">
              {items.map((item) => (
                <div key={item.id} className="bg-surface-container-low p-4 rounded-3xl border border-outline-variant/10 flex flex-col gap-3 group relative">
                  <div className="absolute top-2 right-2 flex gap-1 z-10">
                    {/* Botão calibrador */}
                    <button
                      onClick={() => setCalibratingItem(calibratingItem?.id === item.id ? null : item)}
                      title="Calibrar camada"
                      className={cn(
                        'p-2 rounded-xl transition-all',
                        calibratingItem?.id === item.id
                          ? 'bg-primary text-on-primary'
                          : item.layer_adjustment
                            ? 'bg-primary/20 text-primary hover:bg-primary hover:text-on-primary'
                            : 'bg-surface-container-highest text-on-surface-variant hover:bg-primary/20 hover:text-primary'
                      )}
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => { setEditingItem(item); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="p-2 bg-primary/20 text-primary rounded-xl hover:bg-primary hover:text-background transition-all"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => handleDeleteItem(item.id)} className="p-2 bg-error-container text-on-error-container rounded-xl hover:bg-error hover:text-white transition-all"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <div className="aspect-square rounded-2xl bg-surface-container-highest flex items-center justify-center overflow-hidden">
                    {item.image ? <img src={item.image} alt={item.name} className="w-full h-full object-contain p-2" /> : <ShoppingBag className="w-8 h-8 text-on-surface-variant/30" />}
                  </div>
                  <div>
                    <p className="text-on-surface font-bold uppercase text-sm italic truncate">{item.name}</p>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-[10px] font-black text-secondary uppercase tracking-widest">{item.price} COINS</span>
                      <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest opacity-50">{item.slot}</span>
                    </div>
                    {item.layer_adjustment && <span className="text-[7px] text-primary font-bold uppercase tracking-widest">• calibrado</span>}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── OPERAÇÃO ── */}
        {activeTab === 'operation' && (
          <motion.div key="operation" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="flex flex-col gap-6">
            <div className="bg-surface-container-low p-6 rounded-[2rem] border border-outline-variant/10 space-y-6">
              <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic flex items-center gap-2"><Activity className="w-5 h-5 text-primary" /> GERENCIAR WODS</h3>
              <div className="space-y-4">
                {wods.slice(0, 5).map((wod) => (
                  <div key={wod.id} className="p-4 bg-surface-container-highest/30 rounded-2xl border border-outline-variant/10 flex justify-between items-center">
                    <div><p className="text-on-surface font-bold uppercase text-sm italic">{wod.name}</p><p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">{format(new Date(wod.date), 'dd/MM/yyyy')} • {wod.type}</p></div>
                    <button onClick={() => setEditingWod(wod)} className="p-2 bg-primary/10 text-primary rounded-xl hover:bg-primary hover:text-background transition-all"><Edit2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-error-container/10 p-6 rounded-[2rem] border border-error/20 space-y-4">
              <h3 className="font-headline font-bold text-lg text-error uppercase italic flex items-center gap-2"><Shield className="w-5 h-5" /> NOVA TEMPORADA</h3>
              <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest leading-relaxed">Zera check-ins, duelos, recompensas, resultados de WOD, membros de clans e reseta XP/Coins/Level de todos os atletas.</p>
              <button onClick={handleSystemReset} className="w-full bg-error text-on-error py-4 rounded-2xl font-headline font-black uppercase italic shadow-lg flex items-center justify-center gap-2 hover:bg-error/90 transition-colors"><Trash2 className="w-5 h-5" /> INICIAR NOVA TEMPORADA</button>
            </div>
          </motion.div>
        )}

        {/* ── RANKING ── */}
        {activeTab === 'ranking' && (
          <motion.div key="ranking" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="flex flex-col gap-6">
            <div className="bg-surface-container-low p-6 rounded-[2rem] border border-outline-variant/10 space-y-6">
              <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic flex items-center gap-2"><Trophy className="w-5 h-5 text-primary" /> RANKING DE FREQUÊNCIA</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Mês</label>
                  <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))} className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface appearance-none cursor-pointer">
                    {['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'].map((month, idx) => (<option key={idx} value={idx}>{month}</option>))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Ano</label>
                  <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface appearance-none cursor-pointer">
                    {[2024, 2025, 2026].map(year => (<option key={year} value={year}>{year}</option>))}
                  </select>
                </div>
              </div>
              <div className="space-y-3">
                {historicalFrequencyRanking.map((u, idx) => (
                  <div key={u.id} className="bg-surface-container-highest/30 p-4 rounded-2xl border border-outline-variant/10 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <span className={cn("w-6 text-center font-headline font-black italic", idx < 3 ? "text-primary text-lg" : "text-on-surface-variant text-sm")}>{idx + 1}º</span>
                      <div><p className="text-on-surface font-bold uppercase text-xs">{u.name}</p><p className="text-on-surface-variant text-[8px] font-bold uppercase tracking-widest">{u.role === 'admin' ? 'ADMIN' : u.role === 'coach' ? 'COACH' : 'ALUNO'}</p></div>
                    </div>
                    <div className="text-right"><p className="text-primary font-headline font-black text-lg italic">{u.periodCount}</p><p className="text-on-surface-variant text-[8px] font-black uppercase tracking-widest">CHECK-INS</p></div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── CHECK-INS ── */}
        {activeTab === 'checkins' && (() => {
          const dateStr = checkinsDate;
          const dayOfWeek = new Date(dateStr + 'T12:00:00').getDay();
          const activeSlots = schedule.filter(s => s.isActive && s.days?.includes(dayOfWeek));
          const dayCheckins = users.flatMap(u => u.checkins.filter(c => c.date === dateStr).map(c => ({ ...c, user: u })));
          const totalExpected = activeSlots.reduce((acc, s) => acc + s.capacity, 0);
          const totalPresent = dayCheckins.length;
          const totalAbsent = Math.max(0, totalExpected - totalPresent);

          return (
            <motion.div key="checkins" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="flex flex-col gap-6">
              <div className="bg-surface-container-low p-6 rounded-[2rem] border border-outline-variant/10 space-y-4">
                <div className="flex justify-between items-center flex-wrap gap-3">
                  <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic flex items-center gap-2"><History className="w-5 h-5 text-primary" /> CHECK-INS DO DIA</h3>
                  <input type="date" style={{ colorScheme: 'dark' }} value={checkinsDate} onChange={e => setCheckinsDate(e.target.value)} className="bg-surface-container-highest border-none rounded-2xl px-4 py-3 font-headline font-bold text-on-surface text-sm" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-surface-container-highest rounded-2xl p-4 text-center"><p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest mb-1">Check-ins</p><p className="text-2xl font-headline font-black text-primary italic">{totalPresent}</p></div>
                  <div className="bg-surface-container-highest rounded-2xl p-4 text-center"><p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest mb-1">Esperados</p><p className="text-2xl font-headline font-black text-on-surface italic">{totalExpected}</p></div>
                  <div className="bg-surface-container-highest rounded-2xl p-4 text-center"><p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest mb-1">Ausências</p><p className="text-2xl font-headline font-black text-error italic">{totalAbsent}</p></div>
                </div>
              </div>
              {activeSlots.map(slot => {
                const slotCheckins = dayCheckins.filter(c => c.classTime === slot.time || (!c.classTime && (() => { if (!c.timestamp) return false; const t = new Date(c.timestamp); const [sh,sm] = slot.time.split(':').map(Number); const [eh,em] = slot.endTime.split(':').map(Number); const start = sh*60+sm-(slot.checkinWindowMinutes||60); const end = eh*60+em; const cur = t.getHours()*60+t.getMinutes(); return cur>=start&&cur<=end; })()));
                const pct = slot.capacity > 0 ? Math.round((slotCheckins.length / slot.capacity) * 100) : 0;
                const isOpen = !!checkinsExpanded[slot.id || slot.time];
                return (
                  <div key={slot.id || slot.time} className="bg-surface-container-low rounded-3xl border border-outline-variant/10 overflow-hidden">
                    <button onClick={() => setCheckinsExpanded(prev => ({ ...prev, [slot.id || slot.time]: !prev[slot.id || slot.time] }))} className="w-full flex justify-between items-center p-4">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-2xl"><Clock className="w-5 h-5 text-primary" /></div>
                        <div className="text-left"><p className="text-on-surface font-bold uppercase text-sm italic">{slot.time} – {slot.endTime}</p><p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">Coach: {slot.coach}</p></div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={cn("text-[8px] font-black px-2 py-1 rounded-full uppercase tracking-widest", pct >= 80 ? "bg-primary/20 text-primary" : pct >= 50 ? "bg-secondary/20 text-secondary" : "bg-error-container text-on-error-container")}>{pct}%</span>
                        <ChevronDown className={cn("w-4 h-4 text-on-surface-variant transition-transform", isOpen && "rotate-180")} />
                      </div>
                    </button>
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-outline-variant/10">
                          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {slotCheckins.map((c, idx) => (
                              <div key={idx} className="flex items-center gap-3 bg-surface-container-highest/40 px-3 py-2.5 rounded-2xl">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-headline font-black text-sm flex-shrink-0">{(c.user.name || 'S')[0]}</div>
                                <div className="flex-1 min-w-0"><p className="text-on-surface font-bold uppercase text-xs truncate">{c.user.name}</p>{c.timestamp && <p className="text-on-surface-variant text-[8px] font-bold uppercase tracking-widest">{format(new Date(c.timestamp), 'HH:mm')}</p>}</div>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}

              {/* ── Check-ins sem aula vinculada ── */}
              {(() => {
                const matchedKeys = new Set(
                  activeSlots.flatMap(slot =>
                    dayCheckins.filter(c =>
                      c.classTime === slot.time ||
                      (!c.classTime && (() => {
                        if (!c.timestamp) return false;
                        const t = new Date(c.timestamp);
                        const [sh, sm] = slot.time.split(':').map(Number);
                        const [eh, em] = slot.endTime.split(':').map(Number);
                        const start = sh * 60 + sm - (slot.checkinWindowMinutes || 60);
                        const end = eh * 60 + em;
                        const cur = t.getHours() * 60 + t.getMinutes();
                        return cur >= start && cur <= end;
                      })())
                    ).map(c => c.user.id + (c.timestamp || ''))
                  )
                );
                const unmatched = dayCheckins.filter(c => !matchedKeys.has(c.user.id + (c.timestamp || '')));
                if (unmatched.length === 0) return null;
                return (
                  <div className="bg-surface-container-low rounded-3xl border border-outline-variant/10 overflow-hidden">
                    <div className="p-4 border-b border-outline-variant/10">
                      <p className="text-on-surface font-bold uppercase text-sm italic">SEM AULA VINCULADA</p>
                      <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">{unmatched.length} check-in(s)</p>
                    </div>
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {unmatched.map((c, idx) => (
                        <div key={idx} className="flex items-center gap-3 bg-surface-container-highest/40 px-3 py-2.5 rounded-2xl">
                          <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center text-secondary font-headline font-black text-sm flex-shrink-0">{(c.user.name || 'S')[0]}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-on-surface font-bold uppercase text-xs truncate">{c.user.name}</p>
                            {c.timestamp && <p className="text-on-surface-variant text-[8px] font-bold uppercase tracking-widest">{format(new Date(c.timestamp), 'HH:mm')}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          );
        })()}

      </AnimatePresence>

      {/* ── Modal editar WOD ── */}
      <AnimatePresence>
        {editingWod && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="w-full max-w-lg bg-surface-container-low rounded-[2.5rem] border border-outline-variant/10 p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center">
                <h3 className="font-headline font-bold text-xl text-on-surface uppercase italic">EDITAR WOD</h3>
                <button onClick={() => setEditingWod(null)} className="p-2 text-on-surface-variant hover:text-on-surface transition-colors"><X className="w-6 h-6" /></button>
              </div>
              <div className="space-y-4">
                <div className="space-y-2"><label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Nome do WOD</label><input type="text" value={editingWod.name} onChange={e => setEditingWod({...editingWod, name: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Tipo</label><input type="text" value={editingWod.type} onChange={e => setEditingWod({...editingWod, type: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" /></div>
                  <div className="space-y-2"><label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Data</label><input type="date" style={{ colorScheme: 'dark' }} value={editingWod.date} onChange={e => setEditingWod({...editingWod, date: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" /></div>
                </div>
                <div className="space-y-2"><label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">RX</label><textarea value={editingWod.rx} onChange={e => setEditingWod({...editingWod, rx: e.target.value})} rows={3} className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface resize-none" /></div>
                <button onClick={handleUpdateWod} className="w-full bg-primary text-background py-4 rounded-2xl font-headline font-black uppercase italic shadow-lg flex items-center justify-center gap-2"><Save className="w-5 h-5" /> SALVAR WOD</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Modal editar Desafio ── */}
      <AnimatePresence>
        {isEditingChallenge && editingChallenge && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="w-full max-w-lg bg-surface-container-low rounded-[2.5rem] border border-outline-variant/10 p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center">
                <h3 className="font-headline font-bold text-xl text-on-surface uppercase italic">EDITAR DESAFIO</h3>
                <button onClick={() => { setEditingChallenge(null); setIsEditingChallenge(false); }} className="p-2 text-on-surface-variant hover:text-on-surface transition-colors"><X className="w-6 h-6" /></button>
              </div>
              <div className="space-y-4">
                <div className="space-y-2"><label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Título</label><input type="text" value={editingChallenge.title} onChange={e => setEditingChallenge({...editingChallenge, title: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" /></div>
                <div className="space-y-2"><label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Descrição</label><textarea value={editingChallenge.description} onChange={e => setEditingChallenge({...editingChallenge, description: e.target.value})} rows={3} className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface resize-none" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Data Inicial</label>
                    <input type="date" style={{ colorScheme: 'dark' }} value={editingChallenge.startDate} onChange={e => setEditingChallenge({...editingChallenge, startDate: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Data Final</label>
                    <input type="date" style={{ colorScheme: 'dark' }} value={editingChallenge.endDate} onChange={e => setEditingChallenge({...editingChallenge, endDate: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">XP</label><input type="number" value={editingChallenge.xp} onChange={e => setEditingChallenge({...editingChallenge, xp: parseInt(e.target.value)})} className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" /></div>
                  <div className="space-y-2"><label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Coins</label><input type="number" value={editingChallenge.coins} onChange={e => setEditingChallenge({...editingChallenge, coins: parseInt(e.target.value)})} className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Dificuldade</label>
                    <select value={editingChallenge.difficulty} onChange={e => setEditingChallenge({...editingChallenge, difficulty: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface appearance-none cursor-pointer">
                      <option value="easy">Fácil</option>
                      <option value="medium">Médio</option>
                      <option value="hard">Difícil</option>
                      <option value="special">Especial</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Status</label>
                    <select value={editingChallenge.active ? 'true' : 'false'} onChange={e => setEditingChallenge({...editingChallenge, active: e.target.value === 'true'})} className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface appearance-none cursor-pointer">
                      <option value="true">Ativo</option>
                      <option value="false">Inativo</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Dias necessários</label>
                  <input type="number" min={1} value={editingChallenge.required_days || 1} onChange={e => setEditingChallenge({...editingChallenge, required_days: parseInt(e.target.value) || 1})} className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" />
                </div>
                <button
                  onClick={() => setEditingChallenge({...editingChallenge, require_photo: !editingChallenge.require_photo})}
                  className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl border-2 transition-all font-headline font-bold text-sm uppercase italic ${editingChallenge.require_photo ? 'bg-secondary/20 border-secondary text-secondary' : 'bg-surface-container-highest border-outline-variant/20 text-on-surface-variant'}`}
                >
                  <span className="flex items-center gap-2"><Camera className="w-5 h-5" /> Exigir foto para completar</span>
                  {editingChallenge.require_photo ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                </button>
                <div className="flex gap-3 pt-4">
                  <button onClick={() => { setEditingChallenge(null); setIsEditingChallenge(false); }} className="flex-1 bg-surface-container-highest text-on-surface py-3 rounded-2xl font-headline font-bold uppercase italic">CANCELAR</button>
                  <button onClick={handleUpdateChallenge} className="flex-1 bg-primary text-background py-3 rounded-2xl font-headline font-bold uppercase italic flex items-center justify-center gap-2"><Save className="w-5 h-5" /> SALVAR</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Painel calibrador (bottom sheet) ── */}
      <AnimatePresence>
        {calibratingItem && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
              onClick={() => setCalibratingItem(null)} />
            <CalibratorPanel
              item={calibratingItem}
              onSave={handleSaveLayerAdjustment}
              onClose={() => setCalibratingItem(null)}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  );
      }
