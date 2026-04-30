import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Users, Calendar, Megaphone, Plus, Settings, 
  ChevronRight, ChevronDown, Activity, Check, X, Shield, 
  ImageIcon, ShoppingBag, Trophy, History, Search, Filter,
  Clock, Trash2, Edit2, Save, Camera, Zap, Star
} from 'lucide-react';
import { cn } from '../lib/utils';
import { User, BoxSettings, Schedule, Item, Wod } from '../types';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { uploadImage } from '../utils/image';

// ─── Accordion helper ──────────────────────────────────────────────────────────
function Section({ icon, title, badge, children }: { icon: React.ReactNode; title: string; badge?: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-surface-container-low rounded-3xl border border-outline-variant/10 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-5 hover:bg-surface-container-highest/20 transition-all"
      >
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-xl transition-colors", open ? "bg-primary/20 text-primary" : "bg-surface-container-highest text-on-surface-variant")}>
            {icon}
          </div>
          <span className="font-headline font-black text-sm text-on-surface uppercase italic">{title}</span>
          {badge}
        </div>
        <ChevronDown className={cn("w-4 h-4 text-on-surface-variant transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-outline-variant/10"
          >
            <div className="p-5 flex flex-col gap-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Toggle helper ─────────────────────────────────────────────────────────────
function Toggle({ value, onChange, label, description }: { value: boolean; onChange: () => void; label: string; description?: string }) {
  return (
    <div className="flex items-center justify-between p-4 bg-surface-container-highest/40 rounded-2xl">
      <div>
        <p className="text-xs font-black text-on-surface uppercase italic">{label}</p>
        {description && <p className="text-[10px] text-on-surface-variant mt-0.5">{description}</p>}
      </div>
      <button
        onClick={onChange}
        className={cn("w-12 h-6 rounded-full transition-all relative", value ? "bg-primary" : "bg-surface-container-highest border border-outline-variant/30")}
      >
        <div className={cn("w-5 h-5 rounded-full bg-white shadow transition-all absolute top-0.5", value ? "right-0.5" : "left-0.5")} />
      </button>
    </div>
  );
}

// ─── Input helper ──────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface outline-none text-sm";
const btnPrimary = "w-full bg-primary text-background py-4 rounded-2xl font-headline font-black uppercase italic shadow-lg flex items-center justify-center gap-2 hover:opacity-90 transition-all";

// ─── Main Component ────────────────────────────────────────────────────────────
export default function Admin() {
  const { user } = useAuth();

  // ── State ──────────────────────────────────────────────────────────────────
  const [users, setUsers] = useState<User[]>([]);
  const [schedule, setSchedule] = useState<Schedule[]>([]);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [wods, setWods] = useState<Wod[]>([]);
  const [clans, setClans] = useState<any[]>([]);
  const [settings, setSettings] = useState<BoxSettings>({
    name: '', logo: '', description: '', institutionalPhoto: '', topBanner: '',
    location: { lat: -15.7942, lng: -47.8822 }, radius: 500,
    tvLayout: 'new',
    tvConfig: { showCheckins: true, showRanking: true, showDuels: true, showChallenges: true, rightBlockContent: 'ranking', topBlockContent: 'logo' },
    rewards: {
      xp_per_checkin: 20, coins_per_checkin: 5,
      weekly_bonus_3_xp: 50, weekly_bonus_3_coins: 10,
      weekly_bonus_4_xp: 100, weekly_bonus_4_coins: 20,
      weekly_bonus_5_xp: 150, weekly_bonus_5_coins: 30,
      weekly_bonus_6_xp: 200, weekly_bonus_6_coins: 40,
      level_up_bonus_coins: 50,
      challenge_easy_xp: 50, challenge_easy_coins: 10,
      challenge_medium_xp: 100, challenge_medium_coins: 20,
      challenge_hard_xp: 200, challenge_hard_coins: 40,
      challenge_special_xp: 500, challenge_special_coins: 100,
      duel_win_xp: 40, duel_win_coins: 10,
    },
    isActive: true, announcements: [] as any[], timezone: 'America/Sao_Paulo',
    modules: { economy: true, store: true, duels: true, challenges: true },
  });

  const [selectedRoles, setSelectedRoles] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [uploading, setUploading] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [checkinsDate, setCheckinsDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [checkinsExpanded, setCheckinsExpanded] = useState<Record<string, boolean>>({});

  const [editingWod, setEditingWod] = useState<Wod | null>(null);
  const [editingChallenge, setEditingChallenge] = useState<any | null>(null);
  const [isEditingChallenge, setIsEditingChallenge] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  const [newSchedule, setNewSchedule] = useState<Schedule>({ time: '', endTime: '', coach: '', capacity: 20, days: [1,2,3,4,5], isActive: true, checkinWindowMinutes: 60 });
  const [newChallenge, setNewChallenge] = useState({ title: '', description: '', active: true, startDate: format(new Date(), 'yyyy-MM-dd'), endDate: format(new Date(Date.now() + 7*86400000), 'yyyy-MM-dd'), xp: 50, coins: 10, repeatable: false, dailyLimit: 1, difficulty: 'easy', required_days: 1, require_photo: false });
  const [newItem, setNewItem] = useState<Item>({ id: '', name: '', slot: 'top', price: 100, image: '' });

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchAll = async () => {
    const { data: usersData } = await supabase.from('profiles').select('*');
    const { data: allCheckins } = await supabase.from('checkins').select('*');
    if (usersData) {
      const mapped = usersData.map((u: any) => ({
        id: u.id, email: u.email || '', name: u.name || 'Sem Nome',
        role: u.role || 'athlete', status: u.status || 'pending',
        xp: u.xp || 0, coins: u.coins || 0, level: u.level || 1,
        avatar: { equipped: u.avatar_equipped, inventory: u.avatar_inventory || [] },
        checkins: (allCheckins || []).filter((c: any) => c.user_id === u.id).map((c: any) => ({ date: c.date, timestamp: c.timestamp, classTime: c.class_time })),
        paidBonuses: u.paid_bonuses || [], createdAt: u.created_at,
      }));
      setUsers(mapped);
      const roles: Record<string, string> = {};
      mapped.forEach((u: User) => { roles[u.id] = u.role; });
      setSelectedRoles(roles);
    }
    const { data: settingsData } = await supabase.from('box_settings').select('*').maybeSingle();
    if (settingsData) setSettings(prev => ({ ...prev, ...settingsData, id: settingsData.id, institutionalPhoto: settingsData.institutional_photo, topBanner: settingsData.top_banner, location: { lat: settingsData.lat, lng: settingsData.lng }, rewards: settingsData.rewards || prev.rewards, tvConfig: settingsData.tv_config || (prev as any).tvConfig || {}, modules: settingsData.modules || prev.modules, announcements: (settingsData.announcements || prev.announcements || []) as any[], timezone: settingsData.timezone || prev.timezone, max_clan_members: settingsData.max_clan_members || 10 }));
    const { data: scheduleData } = await supabase.from('schedule').select('*').order('time', { ascending: true });
    if (scheduleData) setSchedule(scheduleData.map((s: any) => ({ id: s.id, time: s.time, endTime: s.end_time, coach: s.coach, capacity: s.capacity, days: s.days, isActive: s.is_active, checkinWindowMinutes: s.checkin_window_minutes })));
    const { data: challengesData } = await supabase.from('challenges').select('*').order('created_at', { ascending: false });
    if (challengesData) setChallenges(challengesData);
    const { data: itemsData } = await supabase.from('items').select('*');
    if (itemsData) setItems(itemsData);
    const { data: wodsData } = await supabase.from('wods').select('*').order('date', { ascending: false });
    if (wodsData) setWods(wodsData);
    const { data: clansData } = await supabase.from('clans').select('*').eq('is_active', true);
    if (clansData) setClans(clansData);
  };

  useEffect(() => {
    fetchAll();
    const channel = supabase.channel('admin_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'challenges' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'duels' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wods' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'box_settings' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clans' }, fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // ── Handlers (todos preservados do original) ───────────────────────────────
  const handleStatusChange = async (userId: string, status: string) => {
    const updateData: Record<string, any> = { status };
    if (status === 'approved') updateData.role = selectedRoles[userId] || 'athlete';
    const { error } = await supabase.from('profiles').update(updateData).eq('id', userId);
    if (!error) setUsers(users.map(u => u.id === userId ? { ...u, status: status as any, ...(status === 'approved' ? { role: updateData.role as any } : {}) } : u));
    else alert('Erro ao atualizar status: ' + error.message);
  };

  const handleRoleChange = (userId: string, role: string) => setSelectedRoles(prev => ({ ...prev, [userId]: role }));

  const handleRoleUpdate = async (userId: string) => {
    const role = selectedRoles[userId] || 'athlete';
    const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
    if (!error) { setUsers(users.map(u => u.id === userId ? { ...u, role: role as any } : u)); alert('Cargo atualizado!'); }
    else alert('Erro: ' + error.message);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'logo' | 'institutionalPhoto' | 'topBanner') => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(field);
    try {
      const publicUrl = await uploadImage(file, 'box-assets', `${field}_${Date.now()}.jpg`);
      setSettings(s => ({ ...s, [field]: publicUrl }));
    } catch (error: any) { alert('Erro ao fazer upload: ' + error.message); }
    finally { setUploading(null); }
  };

  const handleSaveSettings = async () => {
    const { data, error } = await supabase.from('box_settings').update({
      name: settings.name, logo: settings.logo, description: settings.description,
      lat: settings.location?.lat, lng: settings.location?.lng, radius: settings.radius,
      is_active: settings.isActive, rewards: settings.rewards || {},
      tv_config: (settings as any).tvConfig || {}, modules: settings.modules || {},
      announcements: (settings as any).announcements || [], timezone: settings.timezone || 'America/Sao_Paulo',
      clans_enabled: (settings as any).clans_enabled || false, avatar_enabled: (settings as any).avatar_enabled || false,
      max_clan_members: (settings as any).max_clan_members || 10, updated_at: new Date().toISOString(),
    }).eq('id', (settings as any).id).select().maybeSingle();
    if (!error && data) { fetchAll(); alert('Ajustes salvos!'); }
    else alert('Erro ao salvar: ' + (error?.message || 'Erro desconhecido'));
  };

  const handleAddSchedule = async () => {
    if (!newSchedule.time || !newSchedule.endTime || !newSchedule.coach) { alert('Preencha Início, Fim e Coach.'); return; }
    const { data, error } = await supabase.from('schedule').insert({ time: newSchedule.time, end_time: newSchedule.endTime, coach: newSchedule.coach, capacity: newSchedule.capacity, days: newSchedule.days, is_active: newSchedule.isActive, checkin_window_minutes: newSchedule.checkinWindowMinutes }).select();
    if (!error && data) { setSchedule([...schedule, { id: data[0].id, time: data[0].time, endTime: data[0].end_time, coach: data[0].coach, capacity: data[0].capacity, days: data[0].days, isActive: data[0].is_active, checkinWindowMinutes: data[0].checkin_window_minutes }]); setNewSchedule({ time: '', endTime: '', coach: '', capacity: 20, days: [1,2,3,4,5], isActive: true, checkinWindowMinutes: 60 }); alert('Horário adicionado!'); }
    else alert('Erro: ' + (error?.message || 'Erro desconhecido'));
  };

  const handleDeleteSchedule = async (id: string) => { const { error } = await supabase.from('schedule').delete().eq('id', id); if (!error) setSchedule(schedule.filter(s => s.id !== id)); else alert('Erro: ' + error.message); };

  const handleAddChallenge = async () => {
    if (!newChallenge.title || !newChallenge.description) return;
    const { data, error } = await supabase.from('challenges').insert({ title: newChallenge.title, description: newChallenge.description, active: newChallenge.active, start_date: newChallenge.startDate, end_date: newChallenge.endDate, xp: newChallenge.xp, coins: newChallenge.coins, repeatable: newChallenge.repeatable, daily_limit: newChallenge.dailyLimit, difficulty: newChallenge.difficulty, required_days: newChallenge.required_days, require_photo: newChallenge.require_photo }).select();
    if (!error && data) { setChallenges([data[0], ...challenges]); setNewChallenge({ title: '', description: '', active: true, startDate: format(new Date(), 'yyyy-MM-dd'), endDate: format(new Date(Date.now() + 7*86400000), 'yyyy-MM-dd'), xp: 50, coins: 10, repeatable: false, dailyLimit: 1, difficulty: 'easy', required_days: 1, require_photo: false }); alert('Desafio criado!'); }
    else alert('Erro: ' + (error?.message || 'Erro desconhecido'));
  };

  const handleUpdateChallenge = async () => {
    if (!editingChallenge?.title || !editingChallenge?.description) return;
    const { error } = await supabase.from('challenges').update({ title: editingChallenge.title, description: editingChallenge.description, active: editingChallenge.active, start_date: editingChallenge.startDate, end_date: editingChallenge.endDate, xp: editingChallenge.xp, coins: editingChallenge.coins, repeatable: editingChallenge.repeatable, daily_limit: editingChallenge.dailyLimit, difficulty: editingChallenge.difficulty, required_days: editingChallenge.required_days, require_photo: editingChallenge.require_photo }).eq('id', editingChallenge.id);
    if (!error) { setChallenges(challenges.map(c => c.id === editingChallenge.id ? editingChallenge : c)); setEditingChallenge(null); setIsEditingChallenge(false); alert('Desafio atualizado!'); }
    else alert('Erro: ' + error.message);
  };

  const handleDeleteChallenge = async (id: string) => {
    if (!confirm('Excluir este desafio permanentemente?')) return;
    const { error } = await supabase.from('challenges').delete().eq('id', id);
    if (!error) { setChallenges(challenges.filter(c => c.id !== id)); alert('Desafio excluído!'); }
    else alert('Erro: ' + error.message);
  };

  const handleAddItem = async () => {
    if (!newItem.id || !newItem.name || !newItem.price) return;
    const { data, error } = await supabase.from('items').insert({ id: newItem.id, name: newItem.name, slot: newItem.slot, price: newItem.price, image: newItem.image }).select();
    if (!error && data) { setItems([data[0], ...items]); setNewItem({ id: '', name: '', slot: 'top', price: 100, image: '' }); }
    else alert('Erro: ' + (error?.message || 'Erro desconhecido'));
  };

  const handleUpdateItem = async () => {
    if (!editingItem) return;
    const { error } = await supabase.from('items').update({ name: editingItem.name, slot: editingItem.slot, price: editingItem.price, image: editingItem.image }).eq('id', editingItem.id);
    if (!error) { setItems(items.map(i => i.id === editingItem.id ? editingItem : i)); setEditingItem(null); alert('Item atualizado!'); }
    else alert('Erro: ' + error.message);
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Excluir este item?')) return;
    const { error } = await supabase.from('items').delete().eq('id', id);
    if (!error) setItems(items.filter(i => i.id !== id));
    else alert('Erro: ' + error.message);
  };

  const handleDeleteClan = async (clanId: string) => {
    if (!confirm('Excluir este time permanentemente?')) return;
    const { error } = await supabase.from('clans').delete().eq('id', clanId);
    if (!error) { alert('Time excluído!'); fetchAll(); }
    else alert('Erro: ' + error.message);
  };

  const handleUpdateWod = async () => {
    if (!editingWod) return;
    const { error } = await supabase.from('wods').update({ name: editingWod.name, type: editingWod.type, warmup: editingWod.warmup, skill: editingWod.skill, rx: editingWod.rx, scaled: editingWod.scaled, beginner: editingWod.beginner, date: editingWod.date }).eq('id', editingWod.id);
    if (!error) { setWods(wods.map(w => w.id === editingWod.id ? editingWod : w)); setEditingWod(null); alert('WOD atualizado!'); }
    else alert('Erro: ' + error.message);
  };

  const handleSystemReset = async () => {
    const confirmation = prompt('AVISO CRÍTICO: Isso apagará TODOS os check-ins, resultados de WOD, histórico de recompensas, duelos e resetará o XP/Coins de todos os usuários. Digite "RESETAR" para confirmar:');
    if (confirmation !== 'RESETAR') return;
    try {
      await supabase.from('checkins').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('reward_history').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('wod_results').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('duels').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('domination_events').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('profiles').update({ xp: 0, coins: 100, level: 1 }).neq('role', 'admin');
      alert('Sistema resetado com sucesso!');
      fetchAll();
    } catch (err: any) { alert('Erro durante o reset: ' + err.message); }
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const filteredUsers = users.filter(u => {
    const matchSearch = (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || (u.email || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === 'all' || u.status === statusFilter;
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchStatus && matchRole;
  });
  const pendingUsers = users.filter(u => u.status === 'pending');
  const approvedUsers = filteredUsers.filter(u => u.status === 'approved');
  const rejectedUsers = filteredUsers.filter(u => u.status === 'rejected');

  const historicalFrequencyRanking = approvedUsers.map(u => {
    const count = u.checkins.filter(c => {
      const d = new Date(c.date + 'T12:00:00');
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    }).length;
    return { ...u, periodCount: count };
  }).sort((a, b) => b.periodCount - a.periodCount);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 p-4 pt-8 min-h-screen bg-background pb-24">

      <header className="flex justify-between items-center">
        <h1 className="text-3xl font-headline font-black text-on-surface tracking-tight uppercase italic flex items-center gap-3">
          <LayoutDashboard className="w-8 h-8 text-primary" /> PAINEL ADMIN
        </h1>
      </header>

      {/* ── Cards de resumo (novo — do CrossCity) ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total', value: users.length, icon: '👥', color: 'text-on-surface' },
          { label: 'Aprovados', value: users.filter(u => u.status === 'approved').length, icon: '✅', color: 'text-primary' },
          { label: 'Pendentes', value: pendingUsers.length, icon: '⏳', color: 'text-secondary' },
          { label: 'Rejeitados', value: users.filter(u => u.status === 'rejected').length, icon: '❌', color: 'text-error' },
          { label: 'Coaches', value: users.filter(u => u.role === 'coach').length, icon: '🏋️', color: 'text-on-surface' },
          { label: 'Admins', value: users.filter(u => u.role === 'admin').length, icon: '🛡️', color: 'text-on-surface' },
        ].map(m => (
          <div key={m.label} className="bg-surface-container-low rounded-2xl border border-outline-variant/10 p-4 text-center">
            <span className="text-xl">{m.icon}</span>
            <p className={cn("text-2xl font-headline font-black mt-1", m.color)}>{m.value}</p>
            <p className="text-[9px] text-on-surface-variant font-bold uppercase tracking-widest">{m.label}</p>
          </div>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SEÇÃO 1 — SOLICITAÇÕES PENDENTES
      ══════════════════════════════════════════════════════════════════════ */}
      <Section
        icon={<Clock className="w-4 h-4" />}
        title="Solicitações Pendentes"
        badge={pendingUsers.length > 0 && (
          <span className="ml-2 bg-secondary/20 text-secondary text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">
            {pendingUsers.length}
          </span>
        )}
      >
        {pendingUsers.length === 0 ? (
          <p className="text-center text-on-surface-variant text-xs font-bold uppercase tracking-widest opacity-50 italic py-4">Nenhuma solicitação pendente</p>
        ) : pendingUsers.map(u => (
          <div key={u.id} className="bg-surface-container-highest/30 p-4 rounded-2xl border border-outline-variant/10 flex flex-col gap-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-on-surface font-bold uppercase text-sm">{u.name}</p>
                <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">{u.email}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleStatusChange(u.id, 'approved')} className="p-2 bg-primary/20 text-primary rounded-xl hover:bg-primary hover:text-background transition-all"><Check className="w-4 h-4" /></button>
                <button onClick={() => handleStatusChange(u.id, 'rejected')} className="p-2 bg-error-container text-on-error-container rounded-xl hover:bg-error hover:text-on-error transition-all"><X className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="flex gap-2">
              {(['athlete', 'coach', 'admin'] as const).map(role => (
                <button key={role} onClick={() => handleRoleChange(u.id, role)} className={cn("px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all border", selectedRoles[u.id] === role ? "bg-primary text-background border-primary" : "bg-surface-container-highest text-on-surface-variant border-outline-variant/20")}>
                  {role === 'admin' ? 'Admin' : role === 'coach' ? 'Coach' : 'Aluno'}
                </button>
              ))}
            </div>
          </div>
        ))}
      </Section>

      {/* ══════════════════════════════════════════════════════════════════════
          SEÇÃO 2 — CONTROLE DE USUÁRIOS
      ══════════════════════════════════════════════════════════════════════ */}
      <Section icon={<Users className="w-4 h-4" />} title="Controle de Usuários" badge={<span className="ml-2 text-[9px] text-on-surface-variant font-bold">{approvedUsers.length} ativos</span>}>
        {/* Filtros */}
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
            <input type="text" placeholder="Buscar por nome ou email..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-surface-container-highest border-none rounded-2xl py-3 pl-10 pr-4 font-bold text-xs text-on-surface outline-none" />
          </div>
          <div className="flex gap-2">
            <div className="flex items-center gap-2 bg-surface-container-highest px-3 py-2 rounded-xl border border-outline-variant/10 flex-1">
              <Filter className="w-3 h-3 text-primary" />
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest focus:ring-0 p-0 w-full">
                <option value="all">Todos Status</option>
                <option value="pending">Pendentes</option>
                <option value="approved">Aprovados</option>
                <option value="rejected">Rejeitados</option>
              </select>
            </div>
            <div className="flex items-center gap-2 bg-surface-container-highest px-3 py-2 rounded-xl border border-outline-variant/10 flex-1">
              <Shield className="w-3 h-3 text-primary" />
              <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest focus:ring-0 p-0 w-full">
                <option value="all">Todas Funções</option>
                <option value="athlete">Alunos</option>
                <option value="coach">Coaches</option>
                <option value="admin">Admins</option>
              </select>
            </div>
          </div>
        </div>

        {/* Lista aprovados */}
        {approvedUsers.map(u => (
          <div key={u.id} className="bg-surface-container-highest/30 p-4 rounded-2xl border border-outline-variant/10 flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-on-surface font-bold uppercase text-sm">{u.name}</p>
                <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">{u.email}</p>
              </div>
              <span className="bg-primary/20 text-primary text-[8px] font-black px-2 py-0.5 rounded-full uppercase">ATIVO</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {(['athlete', 'coach', 'admin'] as const).map(role => (
                <button key={role} onClick={() => handleRoleChange(u.id, role)} className={cn("px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all border", selectedRoles[u.id] === role ? "bg-primary text-background border-primary" : "bg-surface-container-highest text-on-surface-variant border-outline-variant/20")}>
                  {role === 'admin' ? 'Admin' : role === 'coach' ? 'Coach' : 'Aluno'}
                </button>
              ))}
              {selectedRoles[u.id] !== u.role && (
                <button onClick={() => handleRoleUpdate(u.id)} className="px-3 py-1 bg-secondary text-background rounded-lg text-[8px] font-black uppercase tracking-widest animate-pulse">SALVAR</button>
              )}
            </div>
          </div>
        ))}

        {/* Rejeitados */}
        {rejectedUsers.length > 0 && (
          <div className="flex flex-col gap-2 pt-2 border-t border-outline-variant/10">
            <p className="text-[10px] text-error font-black uppercase tracking-widest">Rejeitados ({rejectedUsers.length})</p>
            {rejectedUsers.map(u => (
              <div key={u.id} className="flex justify-between items-center bg-surface-container-highest/30 p-3 rounded-2xl opacity-60">
                <div>
                  <p className="text-on-surface font-bold uppercase text-xs">{u.name}</p>
                  <p className="text-on-surface-variant text-[8px] font-bold uppercase tracking-widest">{u.email}</p>
                </div>
                <button onClick={() => handleStatusChange(u.id, 'pending')} className="text-[8px] font-black text-primary uppercase tracking-widest hover:underline">Reconsiderar</button>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ══════════════════════════════════════════════════════════════════════
          SEÇÃO 3 — TIMES / CLANS
      ══════════════════════════════════════════════════════════════════════ */}
      <Section icon={<Shield className="w-4 h-4" />} title="Controle de Times" badge={<span className="ml-2 text-[9px] text-on-surface-variant font-bold">{clans.length} times</span>}>
        {clans.length === 0 ? (
          <p className="text-center text-on-surface-variant text-xs font-bold uppercase tracking-widest opacity-50 italic py-4">Nenhum time ativo</p>
        ) : clans.map(clan => (
          <div key={clan.id} className="flex justify-between items-center bg-surface-container-highest/30 p-4 rounded-2xl border border-outline-variant/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-headline font-black text-lg" style={{ background: clan.color + '30', color: clan.color }}>
                {clan.name[0]}
              </div>
              <div>
                <p className="text-on-surface font-bold uppercase text-sm italic">{clan.name}</p>
                <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">{clan.motto || 'Sem motto'}</p>
              </div>
            </div>
            <button onClick={() => handleDeleteClan(clan.id)} className="p-2 text-on-surface-variant hover:text-error transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </Section>

      {/* ══════════════════════════════════════════════════════════════════════
          SEÇÃO 4 — GRADE DE HORÁRIOS
      ══════════════════════════════════════════════════════════════════════ */}
      <Section icon={<Calendar className="w-4 h-4" />} title="Grade de Horários">
        {/* Form */}
        <div className="flex flex-col gap-3 p-4 bg-surface-container-highest/30 rounded-2xl border border-outline-variant/10">
          <p className="text-[10px] font-black text-primary uppercase tracking-widest">Adicionar Horário</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Início"><input type="time" value={newSchedule.time} onChange={e => setNewSchedule({...newSchedule, time: e.target.value})} className={inputCls} /></Field>
            <Field label="Fim"><input type="time" value={newSchedule.endTime} onChange={e => setNewSchedule({...newSchedule, endTime: e.target.value})} className={inputCls} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Coach">
              <select value={newSchedule.coach} onChange={e => setNewSchedule({...newSchedule, coach: e.target.value})} className={inputCls}>
                <option value="">Selecionar</option>
                {users.filter(u => u.role === 'coach' || u.role === 'admin').map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Capacidade"><input type="number" value={newSchedule.capacity} onChange={e => setNewSchedule({...newSchedule, capacity: parseInt(e.target.value) || 0})} className={inputCls} /></Field>
          </div>
          <Field label="Janela de check-in (min antes)"><input type="number" value={newSchedule.checkinWindowMinutes} onChange={e => setNewSchedule({...newSchedule, checkinWindowMinutes: parseInt(e.target.value) || 0})} className={inputCls} /></Field>
          <Field label="Dias da semana">
            <div className="flex gap-2">
              {['D','S','T','Q','Q','S','S'].map((day, idx) => (
                <button key={idx} onClick={() => { const days = newSchedule.days || []; setNewSchedule({...newSchedule, days: days.includes(idx) ? days.filter(d => d !== idx) : [...days, idx]}); }} className={cn("w-9 h-9 rounded-xl font-headline font-bold text-xs transition-all border", newSchedule.days?.includes(idx) ? "bg-primary text-background border-primary" : "bg-surface-container-highest text-on-surface-variant border-outline-variant/10")}>{day}</button>
              ))}
            </div>
          </Field>
          <button onClick={handleAddSchedule} className={btnPrimary}><Plus className="w-4 h-4" /> Adicionar Horário</button>
        </div>

        {/* Lista */}
        {schedule.map(s => (
          <div key={s.id} className="flex justify-between items-center bg-surface-container-highest/30 p-4 rounded-2xl border border-outline-variant/10 group">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl"><Clock className="w-4 h-4 text-primary" /></div>
              <div>
                <p className="text-on-surface font-bold uppercase text-sm italic">{s.time} – {s.endTime}</p>
                <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">Coach: {s.coach} • Cap: {s.capacity}</p>
                <div className="flex gap-0.5 mt-1">
                  {['D','S','T','Q','Q','S','S'].map((day, idx) => (
                    <span key={idx} className={cn("text-[7px] font-black w-3.5 h-3.5 flex items-center justify-center rounded-sm", s.days?.includes(idx) ? "bg-primary/20 text-primary" : "bg-surface-container-highest text-on-surface-variant opacity-30")}>{day}</span>
                  ))}
                </div>
              </div>
            </div>
            <button onClick={() => s.id && handleDeleteSchedule(s.id)} className="p-2 text-on-surface-variant hover:text-error transition-colors opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </Section>

      {/* ══════════════════════════════════════════════════════════════════════
          SEÇÃO 5 — DESAFIOS
      ══════════════════════════════════════════════════════════════════════ */}
      <Section icon={<Star className="w-4 h-4" />} title="Desafios" badge={<span className="ml-2 text-[9px] text-on-surface-variant font-bold">{challenges.length} desafios</span>}>
        {/* Form */}
        <div className="flex flex-col gap-3 p-4 bg-surface-container-highest/30 rounded-2xl border border-outline-variant/10">
          <p className="text-[10px] font-black text-primary uppercase tracking-widest">Criar Novo Desafio</p>
          <Field label="Título"><input type="text" value={newChallenge.title} onChange={e => setNewChallenge({...newChallenge, title: e.target.value})} className={inputCls} /></Field>
          <Field label="Descrição"><textarea value={newChallenge.description} onChange={e => setNewChallenge({...newChallenge, description: e.target.value})} rows={3} className={inputCls + " resize-none"} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="XP"><input type="number" value={newChallenge.xp} onChange={e => setNewChallenge({...newChallenge, xp: parseInt(e.target.value)})} className={inputCls} /></Field>
            <Field label="Coins"><input type="number" value={newChallenge.coins} onChange={e => setNewChallenge({...newChallenge, coins: parseInt(e.target.value)})} className={inputCls} /></Field>
          </div>
          <Field label="Dias necessários"><input type="number" min={1} value={newChallenge.required_days} onChange={e => setNewChallenge({...newChallenge, required_days: parseInt(e.target.value) || 1})} className={inputCls} /></Field>
          <Toggle value={newChallenge.require_photo} onChange={() => setNewChallenge({...newChallenge, require_photo: !newChallenge.require_photo})} label="Exigir foto como prova" />
          <button onClick={handleAddChallenge} className={btnPrimary}><Plus className="w-4 h-4" /> Criar Desafio</button>
        </div>

        {/* Lista */}
        {challenges.map(c => (
          <div key={c.id} className="bg-surface-container-highest/30 p-4 rounded-2xl border border-outline-variant/10 flex justify-between items-start group">
            <div className="flex-1">
              <p className="text-on-surface font-bold uppercase text-sm italic">{c.title}</p>
              <p className="text-on-surface-variant text-[10px] mt-1">{c.description}</p>
              <div className="flex gap-3 mt-2">
                <span className="text-[10px] font-black text-primary uppercase">{c.xp} XP</span>
                <span className="text-[10px] font-black text-secondary uppercase">{c.coins} Coins</span>
                <span className={cn("text-[8px] font-black px-2 py-0.5 rounded-full uppercase", c.active ? "bg-primary/20 text-primary" : "bg-surface-container-highest text-on-surface-variant")}>{c.active ? 'ATIVO' : 'INATIVO'}</span>
              </div>
            </div>
            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
              <button onClick={() => { setEditingChallenge({ ...c, startDate: c.start_date, endDate: c.end_date, dailyLimit: c.daily_limit }); setIsEditingChallenge(true); }} className="p-2 bg-primary/20 text-primary rounded-xl hover:bg-primary/30"><Edit2 className="w-3 h-3" /></button>
              <button onClick={() => handleDeleteChallenge(c.id)} className="p-2 bg-error-container text-on-error-container rounded-xl hover:bg-error/30"><Trash2 className="w-3 h-3" /></button>
            </div>
          </div>
        ))}
      </Section>

      {/* ══════════════════════════════════════════════════════════════════════
          SEÇÃO 6 — LOJA
      ══════════════════════════════════════════════════════════════════════ */}
      <Section icon={<ShoppingBag className="w-4 h-4" />} title="Loja de Avatares" badge={<span className="ml-2 text-[9px] text-on-surface-variant font-bold">{items.length} itens</span>}>
        <div className="flex flex-col gap-3 p-4 bg-surface-container-highest/30 rounded-2xl border border-outline-variant/10">
          <p className="text-[10px] font-black text-primary uppercase tracking-widest">{editingItem ? 'Editar Item' : 'Adicionar Item'}</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="ID"><input type="text" value={editingItem ? editingItem.id : newItem.id} onChange={e => editingItem ? setEditingItem({...editingItem, id: e.target.value}) : setNewItem({...newItem, id: e.target.value})} disabled={!!editingItem} placeholder="ex: cap_red" className={inputCls + " disabled:opacity-50"} /></Field>
            <Field label="Nome"><input type="text" value={editingItem ? editingItem.name : newItem.name} onChange={e => editingItem ? setEditingItem({...editingItem, name: e.target.value}) : setNewItem({...newItem, name: e.target.value})} className={inputCls} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Slot">
              <select value={editingItem ? editingItem.slot : newItem.slot} onChange={e => editingItem ? setEditingItem({...editingItem, slot: e.target.value as any}) : setNewItem({...newItem, slot: e.target.value as any})} className={inputCls}>
                <option value="top">Cabeça</option><option value="body">Corpo</option><option value="legs">Pernas</option><option value="feet">Pés</option><option value="accessory">Acessório</option>
              </select>
            </Field>
            <Field label="Preço (Coins)"><input type="number" value={editingItem ? editingItem.price : newItem.price} onChange={e => editingItem ? setEditingItem({...editingItem, price: parseInt(e.target.value)}) : setNewItem({...newItem, price: parseInt(e.target.value)})} className={inputCls} /></Field>
          </div>
          <Field label="URL da Imagem"><input type="text" value={editingItem ? editingItem.image : newItem.image} onChange={e => editingItem ? setEditingItem({...editingItem, image: e.target.value}) : setNewItem({...newItem, image: e.target.value})} placeholder="https://..." className={inputCls} /></Field>
          <div className="flex gap-2">
            {editingItem ? (
              <>
                <button onClick={handleUpdateItem} className={btnPrimary}><Save className="w-4 h-4" /> Salvar</button>
                <button onClick={() => setEditingItem(null)} className="flex-1 bg-surface-container-highest text-on-surface py-4 rounded-2xl font-headline font-black uppercase italic flex items-center justify-center gap-2"><X className="w-4 h-4" /> Cancelar</button>
              </>
            ) : (
              <button onClick={handleAddItem} className={btnPrimary}><Plus className="w-4 h-4" /> Adicionar Item</button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {items.map(item => (
            <div key={item.id} className="bg-surface-container-highest/30 p-3 rounded-2xl border border-outline-variant/10 flex flex-col gap-2 group relative">
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all z-10">
                <button onClick={() => setEditingItem(item)} className="p-1.5 bg-primary/20 text-primary rounded-lg hover:bg-primary hover:text-background transition-all"><Edit2 className="w-3 h-3" /></button>
                <button onClick={() => handleDeleteItem(item.id)} className="p-1.5 bg-error-container text-on-error-container rounded-lg"><Trash2 className="w-3 h-3" /></button>
              </div>
              <div className="aspect-square rounded-xl bg-surface-container-highest flex items-center justify-center overflow-hidden">
                {item.image ? <img src={item.image} alt={item.name} className="w-full h-full object-contain p-2" /> : <ShoppingBag className="w-6 h-6 text-on-surface-variant/30" />}
              </div>
              <p className="text-on-surface font-bold uppercase text-xs italic truncate">{item.name}</p>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-secondary uppercase">{item.price} Coins</span>
                <span className="text-[9px] font-black text-on-surface-variant uppercase opacity-50">{item.slot}</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ══════════════════════════════════════════════════════════════════════
          SEÇÃO 7 — CONFIGURAÇÕES DO BOX (novo: logo + settings juntos)
      ══════════════════════════════════════════════════════════════════════ */}
      <Section icon={<Settings className="w-4 h-4" />} title="Configurações do Box">
        {/* Imagens */}
        <p className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2"><ImageIcon className="w-3 h-3" /> Imagens e Identidade</p>
        <div className="grid grid-cols-3 gap-4">
          {([
            { key: 'logo', label: 'Logo' },
            { key: 'institutionalPhoto', label: 'Foto Institucional' },
            { key: 'topBanner', label: 'Banner Superior' },
          ] as const).map(({ key, label }) => (
            <div key={key} className="flex flex-col gap-2">
              <label className="text-[9px] text-on-surface-variant font-bold uppercase tracking-widest">{label}</label>
              <div className="relative group aspect-square rounded-2xl bg-surface-container-highest overflow-hidden border-2 border-dashed border-outline-variant/20 flex items-center justify-center">
                {(settings as any)[key] ? <img src={(settings as any)[key]} alt={label} className="w-full h-full object-contain p-2" /> : <ImageIcon className="w-6 h-6 text-on-surface-variant/30" />}
                <label className="absolute inset-0 flex items-center justify-center bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <input type="file" className="hidden" onChange={e => handleFileUpload(e, key)} accept="image/*" />
                  <div className="flex flex-col items-center gap-1"><Camera className="w-5 h-5 text-primary" /><span className="text-[7px] font-black text-on-surface uppercase">ALTERAR</span></div>
                </label>
                {uploading === key && <div className="absolute inset-0 bg-background/60 flex items-center justify-center"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}
              </div>
            </div>
          ))}
        </div>

        {/* Informações básicas */}
        <p className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2"><Settings className="w-3 h-3" /> Informações Básicas</p>
        <Field label="Nome do Box"><input type="text" value={settings.name} onChange={e => setSettings({...settings, name: e.target.value})} className={inputCls} /></Field>
        <Field label="Descrição"><textarea value={settings.description} onChange={e => setSettings({...settings, description: e.target.value})} rows={3} className={inputCls + " resize-none"} /></Field>

        {/* Recompensas */}
        <p className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2"><Zap className="w-3 h-3" /> Recompensas Padrão</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="XP por Check-in"><input type="number" value={settings.rewards.xp_per_checkin} onChange={e => setSettings(s => ({...s, rewards: {...s.rewards, xp_per_checkin: parseInt(e.target.value) || 0}}))} className={inputCls} /></Field>
          <Field label="Coins por Check-in"><input type="number" value={settings.rewards.coins_per_checkin} onChange={e => setSettings(s => ({...s, rewards: {...s.rewards, coins_per_checkin: parseInt(e.target.value) || 0}}))} className={inputCls} /></Field>
          <Field label="XP Vitória Duelo"><input type="number" value={settings.rewards.duel_win_xp} onChange={e => setSettings(s => ({...s, rewards: {...s.rewards, duel_win_xp: parseInt(e.target.value) || 0}}))} className={inputCls} /></Field>
          <Field label="Coins Vitória Duelo"><input type="number" value={settings.rewards.duel_win_coins} onChange={e => setSettings(s => ({...s, rewards: {...s.rewards, duel_win_coins: parseInt(e.target.value) || 0}}))} className={inputCls} /></Field>
          <Field label="Coins por Level Up"><input type="number" value={settings.rewards.level_up_bonus_coins} onChange={e => setSettings(s => ({...s, rewards: {...s.rewards, level_up_bonus_coins: parseInt(e.target.value) || 0}}))} className={inputCls} /></Field>
        </div>

        {/* Bônus semanais */}
        <p className="text-[10px] font-black text-primary uppercase tracking-widest">Bônus Semanais</p>
        {[3, 4, 5, 6].map(count => (
          <div key={count} className="grid grid-cols-2 gap-3 p-3 bg-surface-container-highest/30 rounded-2xl border border-outline-variant/10">
            <div className="col-span-2 text-[9px] text-primary font-black uppercase tracking-widest">{count} check-ins/semana</div>
            <Field label="XP Bônus"><input type="number" value={(settings.rewards as any)[`weekly_bonus_${count}_xp`]} onChange={e => setSettings(s => ({...s, rewards: {...s.rewards, [`weekly_bonus_${count}_xp`]: parseInt(e.target.value) || 0}}))} className={inputCls} /></Field>
            <Field label="Coins Bônus"><input type="number" value={(settings.rewards as any)[`weekly_bonus_${count}_coins`]} onChange={e => setSettings(s => ({...s, rewards: {...s.rewards, [`weekly_bonus_${count}_coins`]: parseInt(e.target.value) || 0}}))} className={inputCls} /></Field>
          </div>
        ))}

        {/* Desafios por dificuldade */}
        <p className="text-[10px] font-black text-primary uppercase tracking-widest">Recompensas por Desafio</p>
        {(['easy', 'medium', 'hard', 'special'] as const).map(diff => (
          <div key={diff} className="grid grid-cols-2 gap-3 p-3 bg-surface-container-highest/30 rounded-2xl border border-outline-variant/10">
            <div className="col-span-2 text-[9px] text-primary font-black uppercase tracking-widest">Desafio {diff === 'easy' ? 'Fácil' : diff === 'medium' ? 'Médio' : diff === 'hard' ? 'Difícil' : 'Especial'}</div>
            <Field label="XP"><input type="number" value={(settings.rewards as any)[`challenge_${diff}_xp`]} onChange={e => setSettings(s => ({...s, rewards: {...s.rewards, [`challenge_${diff}_xp`]: parseInt(e.target.value) || 0}}))} className={inputCls} /></Field>
            <Field label="Coins"><input type="number" value={(settings.rewards as any)[`challenge_${diff}_coins`]} onChange={e => setSettings(s => ({...s, rewards: {...s.rewards, [`challenge_${diff}_coins`]: parseInt(e.target.value) || 0}}))} className={inputCls} /></Field>
          </div>
        ))}

        {/* Módulos */}
        <p className="text-[10px] font-black text-primary uppercase tracking-widest">Módulos</p>
        <Toggle value={(settings as any)?.clans_enabled || false} onChange={() => setSettings({...settings, clans_enabled: !(settings as any).clans_enabled} as any)} label="Sistema de Times" description="Ativa disputa por territórios entre times" />
        <Toggle value={(settings as any)?.avatar_enabled || false} onChange={() => setSettings({...settings, avatar_enabled: !(settings as any).avatar_enabled} as any)} label="Sistema de Avatar" description="Atletas customizam seu personagem na loja" />
        <Toggle value={settings.modules.economy} onChange={() => setSettings({...settings, modules: {...settings.modules, economy: !settings.modules.economy}})} label="Módulo Economia" description="Ativa/desativa sistema de moedas e XP" />
        <Toggle value={settings.modules.store} onChange={() => setSettings({...settings, modules: {...settings.modules, store: !settings.modules.store}})} label="Módulo Loja" description="Ativa/desativa loja de avatares" />

        {/* Avisos */}
        <p className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2"><Megaphone className="w-3 h-3" /> Avisos do Box</p>
        <button onClick={() => setSettings(s => ({...s, announcements: [...s.announcements, { id: Date.now().toString(), title: '', content: '', date: new Date().toISOString(), active: true }]}))} className="w-full py-3 border-2 border-dashed border-outline-variant/20 rounded-2xl text-[10px] font-black text-on-surface-variant uppercase tracking-widest hover:border-primary/30 hover:text-primary transition-all flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" /> Adicionar Aviso
        </button>
        {settings.announcements.map((ann, idx) => (
          <div key={ann.id} className="p-4 bg-surface-container-highest/30 rounded-2xl border border-outline-variant/10 flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-primary font-black uppercase tracking-widest">Aviso #{idx + 1}</span>
              <button onClick={() => setSettings(s => ({...s, announcements: s.announcements.filter(a => a.id !== ann.id)}))} className="text-error"><Trash2 className="w-4 h-4" /></button>
            </div>
            <input type="text" placeholder="TÍTULO" value={ann.title} onChange={e => { const a = [...settings.announcements]; a[idx].title = e.target.value; setSettings({...settings, announcements: a}); }} className={inputCls} />
            <textarea placeholder="CONTEÚDO" value={ann.content} onChange={e => { const a = [...settings.announcements]; a[idx].content = e.target.value; setSettings({...settings, announcements: a}); }} rows={2} className={inputCls + " resize-none"} />
          </div>
        ))}

        <button onClick={handleSaveSettings} className={btnPrimary}><Save className="w-5 h-5" /> Salvar Todas as Configurações</button>
      </Section>

      {/* ══════════════════════════════════════════════════════════════════════
          SEÇÃO 8 — WODs / OPERAÇÃO
      ══════════════════════════════════════════════════════════════════════ */}
      <Section icon={<Activity className="w-4 h-4" />} title="Gerenciar WODs">
        {wods.slice(0, 5).map(wod => (
          <div key={wod.id} className="flex justify-between items-center bg-surface-container-highest/30 p-4 rounded-2xl border border-outline-variant/10">
            <div>
              <p className="text-on-surface font-bold uppercase text-sm italic">{wod.name}</p>
              <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">{format(new Date(wod.date), 'dd/MM/yyyy')} • {wod.type}</p>
            </div>
            <button onClick={() => setEditingWod(wod)} className="p-2 bg-primary/10 text-primary rounded-xl hover:bg-primary hover:text-background transition-all"><Edit2 className="w-4 h-4" /></button>
          </div>
        ))}
      </Section>

      {/* ══════════════════════════════════════════════════════════════════════
          SEÇÃO 9 — RANKING
      ══════════════════════════════════════════════════════════════════════ */}
      <Section icon={<Trophy className="w-4 h-4" />} title="Ranking de Frequência">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mês">
            <select value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))} className={inputCls}>
              {['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'].map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
          </Field>
          <Field label="Ano">
            <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))} className={inputCls}>
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </Field>
        </div>
        {historicalFrequencyRanking.map((u, idx) => (
          <div key={u.id} className="flex justify-between items-center bg-surface-container-highest/30 p-3 rounded-2xl border border-outline-variant/10">
            <div className="flex items-center gap-3">
              <span className={cn("w-6 text-center font-headline font-black italic", idx < 3 ? "text-primary text-lg" : "text-on-surface-variant text-sm")}>{idx + 1}º</span>
              <div>
                <p className="text-on-surface font-bold uppercase text-xs">{u.name}</p>
                <p className="text-on-surface-variant text-[8px] font-bold uppercase tracking-widest">{u.role === 'admin' ? 'Admin' : u.role === 'coach' ? 'Coach' : 'Aluno'}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-primary font-headline font-black text-lg italic">{u.periodCount}</p>
              <p className="text-on-surface-variant text-[8px] font-black uppercase tracking-widest">check-ins</p>
            </div>
          </div>
        ))}
      </Section>

      {/* ══════════════════════════════════════════════════════════════════════
          SEÇÃO 10 — CHECK-INS DO DIA
      ══════════════════════════════════════════════════════════════════════ */}
      <Section icon={<History className="w-4 h-4" />} title="Check-ins do Dia">
        {(() => {
          const dayOfWeek = new Date(checkinsDate + 'T12:00:00').getDay();
          const activeSlots = schedule.filter(s => s.isActive && s.days?.includes(dayOfWeek));
          const dayCheckins = users.flatMap(u => u.checkins.filter(c => c.date === checkinsDate).map(c => ({ ...c, user: u })));
          const totalPresent = dayCheckins.length;
          const totalExpected = activeSlots.reduce((acc, s) => acc + s.capacity, 0);
          return (
            <>
              <div className="flex justify-between items-center">
                <input type="date" value={checkinsDate} onChange={e => setCheckinsDate(e.target.value)} className="bg-surface-container-highest border-none rounded-2xl px-4 py-3 font-headline font-bold text-on-surface text-sm outline-none" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-surface-container-highest rounded-2xl p-4 text-center"><p className="text-[9px] text-on-surface-variant font-bold uppercase tracking-widest mb-1">Check-ins</p><p className="text-2xl font-headline font-black text-primary italic">{totalPresent}</p></div>
                <div className="bg-surface-container-highest rounded-2xl p-4 text-center"><p className="text-[9px] text-on-surface-variant font-bold uppercase tracking-widest mb-1">Esperados</p><p className="text-2xl font-headline font-black text-on-surface italic">{totalExpected}</p></div>
                <div className="bg-surface-container-highest rounded-2xl p-4 text-center"><p className="text-[9px] text-on-surface-variant font-bold uppercase tracking-widest mb-1">Ausências</p><p className="text-2xl font-headline font-black text-error italic">{Math.max(0, totalExpected - totalPresent)}</p></div>
              </div>
              {activeSlots.length === 0 ? (
                <p className="text-center text-on-surface-variant text-xs font-bold uppercase tracking-widest opacity-50 italic py-4">Nenhuma aula programada para este dia</p>
              ) : activeSlots.map(slot => {
                const slotCheckins = dayCheckins.filter(c => c.classTime === slot.time || (!c.classTime && (() => { if (!c.timestamp) return false; const t = new Date(c.timestamp); const [sh, sm] = slot.time.split(':').map(Number); const [eh, em] = slot.endTime.split(':').map(Number); const start = sh * 60 + sm - (slot.checkinWindowMinutes || 60); const end = eh * 60 + em; const cur = t.getHours() * 60 + t.getMinutes(); return cur >= start && cur <= end; })()));
                const pct = slot.capacity > 0 ? Math.round((slotCheckins.length / slot.capacity) * 100) : 0;
                const isOpen = !!checkinsExpanded[slot.id || slot.time];
                return (
                  <div key={slot.id || slot.time} className="bg-surface-container-highest/30 rounded-2xl border border-outline-variant/10 overflow-hidden">
                    <button onClick={() => setCheckinsExpanded(prev => ({ ...prev, [slot.id || slot.time]: !prev[slot.id || slot.time] }))} className="w-full flex justify-between items-center p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl"><Clock className="w-4 h-4 text-primary" /></div>
                        <div className="text-left">
                          <p className="text-on-surface font-bold uppercase text-sm italic">{slot.time} – {slot.endTime}</p>
                          <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">Coach: {slot.coach}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn("text-[8px] font-black px-2 py-1 rounded-full uppercase tracking-widest", pct >= 80 ? "bg-primary/20 text-primary" : pct >= 50 ? "bg-secondary/20 text-secondary" : "bg-error-container text-on-error-container")}>{slotCheckins.length}/{slot.capacity}</span>
                        <ChevronDown className={cn("w-4 h-4 text-on-surface-variant transition-transform", isOpen && "rotate-180")} />
                      </div>
                    </button>
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-outline-variant/10">
                          <div className="p-4 grid grid-cols-2 gap-2">
                            {slotCheckins.length === 0 ? <p className="col-span-2 text-center text-on-surface-variant text-xs font-bold uppercase tracking-widest opacity-50 italic py-4">Nenhum check-in</p> : slotCheckins.map((c, idx) => (
                              <div key={idx} className="flex items-center gap-2 bg-surface-container-highest/40 px-3 py-2 rounded-xl">
                                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-headline font-black text-xs flex-shrink-0">{(c.user.name || 'S')[0]}</div>
                                <div className="flex-1 min-w-0"><p className="text-on-surface font-bold uppercase text-xs truncate">{c.user.name}</p>{c.timestamp && <p className="text-on-surface-variant text-[8px] font-bold uppercase">{format(new Date(c.timestamp), 'HH:mm')}</p>}</div>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </>
          );
        })()}
      </Section>

      {/* ══════════════════════════════════════════════════════════════════════
          SEÇÃO 11 — ZONA DE PERIGO
      ══════════════════════════════════════════════════════════════════════ */}
      <Section icon={<Shield className="w-4 h-4" />} title="Zona de Perigo">
        <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest leading-relaxed">O reset limpará todos os check-ins, resultados de WOD, histórico de recompensas e duelos, mantendo os perfis com XP zerado.</p>
        <button onClick={handleSystemReset} className="w-full bg-error text-on-error py-4 rounded-2xl font-headline font-black uppercase italic shadow-lg flex items-center justify-center gap-2 hover:bg-error/90 transition-colors">
          <Trash2 className="w-5 h-5" /> Resetar Sistema para Nova Temporada
        </button>
      </Section>

      {/* ══════════════════════════════════════════════════════════════════════
          MODAIS
      ══════════════════════════════════════════════════════════════════════ */}

      {/* Modal Editar WOD */}
      <AnimatePresence>
        {editingWod && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="w-full max-w-lg bg-surface-container-low rounded-[2.5rem] border border-outline-variant/10 p-8 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center">
                <h3 className="font-headline font-bold text-xl text-on-surface uppercase italic">Editar WOD</h3>
                <button onClick={() => setEditingWod(null)} className="p-2 text-on-surface-variant hover:text-on-surface"><X className="w-6 h-6" /></button>
              </div>
              <Field label="Nome"><input type="text" value={editingWod.name} onChange={e => setEditingWod({...editingWod, name: e.target.value})} className={inputCls} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tipo"><input type="text" value={editingWod.type} onChange={e => setEditingWod({...editingWod, type: e.target.value})} className={inputCls} /></Field>
                <Field label="Data"><input type="date" value={editingWod.date} onChange={e => setEditingWod({...editingWod, date: e.target.value})} className={inputCls} /></Field>
              </div>
              <Field label="RX"><textarea value={editingWod.rx} onChange={e => setEditingWod({...editingWod, rx: e.target.value})} rows={3} className={inputCls + " resize-none"} /></Field>
              <Field label="Scaled"><textarea value={editingWod.scaled} onChange={e => setEditingWod({...editingWod, scaled: e.target.value})} rows={2} className={inputCls + " resize-none"} /></Field>
              <Field label="Beginner"><textarea value={editingWod.beginner} onChange={e => setEditingWod({...editingWod, beginner: e.target.value})} rows={2} className={inputCls + " resize-none"} /></Field>
              <button onClick={handleUpdateWod} className={btnPrimary}><Save className="w-5 h-5" /> Salvar WOD</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Editar Desafio */}
      <AnimatePresence>
        {isEditingChallenge && editingChallenge && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="w-full max-w-lg bg-surface-container-low rounded-[2.5rem] border border-outline-variant/10 p-8 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center">
                <h3 className="font-headline font-bold text-xl text-on-surface uppercase italic">Editar Desafio</h3>
                <button onClick={() => { setEditingChallenge(null); setIsEditingChallenge(false); }} className="p-2 text-on-surface-variant"><X className="w-6 h-6" /></button>
              </div>
              <Field label="Título"><input type="text" value={editingChallenge.title} onChange={e => setEditingChallenge({...editingChallenge, title: e.target.value})} className={inputCls} /></Field>
              <Field label="Descrição"><textarea value={editingChallenge.description} onChange={e => setEditingChallenge({...editingChallenge, description: e.target.value})} rows={3} className={inputCls + " resize-none"} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Data Inicial"><input type="date" value={editingChallenge.startDate} onChange={e => setEditingChallenge({...editingChallenge, startDate: e.target.value})} className={inputCls} /></Field>
                <Field label="Data Final"><input type="date" value={editingChallenge.endDate} onChange={e => setEditingChallenge({...editingChallenge, endDate: e.target.value})} className={inputCls} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="XP"><input type="number" value={editingChallenge.xp} onChange={e => setEditingChallenge({...editingChallenge, xp: parseInt(e.target.value)})} className={inputCls} /></Field>
                <Field label="Coins"><input type="number" value={editingChallenge.coins} onChange={e => setEditingChallenge({...editingChallenge, coins: parseInt(e.target.value)})} className={inputCls} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Dificuldade">
                  <select value={editingChallenge.difficulty} onChange={e => setEditingChallenge({...editingChallenge, difficulty: e.target.value})} className={inputCls}>
                    <option value="easy">Fácil</option><option value="medium">Médio</option><option value="hard">Difícil</option><option value="special">Especial</option>
                  </select>
                </Field>
                <Field label="Status">
                  <select value={editingChallenge.active ? 'true' : 'false'} onChange={e => setEditingChallenge({...editingChallenge, active: e.target.value === 'true'})} className={inputCls}>
                    <option value="true">Ativo</option><option value="false">Inativo</option>
                  </select>
                </Field>
              </div>
              <Field label="Dias necessários"><input type="number" min={1} value={editingChallenge.required_days || 1} onChange={e => setEditingChallenge({...editingChallenge, required_days: parseInt(e.target.value) || 1})} className={inputCls} /></Field>
              <Toggle value={editingChallenge.require_photo} onChange={() => setEditingChallenge({...editingChallenge, require_photo: !editingChallenge.require_photo})} label="Exigir foto como prova" />
              <div className="flex gap-3 pt-2">
                <button onClick={() => { setEditingChallenge(null); setIsEditingChallenge(false); }} className="flex-1 bg-surface-container-highest text-on-surface py-3 rounded-2xl font-headline font-bold uppercase italic">Cancelar</button>
                <button onClick={handleUpdateChallenge} className="flex-1 bg-primary text-background py-3 rounded-2xl font-headline font-bold uppercase italic flex items-center justify-center gap-2"><Save className="w-4 h-4" /> Salvar</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
