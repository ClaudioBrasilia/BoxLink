import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Users, MapPin, Calendar, Megaphone, Plus, Settings, 
  ChevronRight, ChevronDown, Activity, Check, X, Shield, UserPlus, 
  ImageIcon, ShoppingBag, Tv, Trophy, History, Search, Filter,
  Clock, ToggleLeft, ToggleRight, Trash2, Edit2, Save, Camera
} from 'lucide-react';
import { cn } from '../lib/utils';
import { User, BoxSettings, Schedule, Item, Duel, Wod, Clan } from '../types';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { supabase } from '../lib/supabase';
import { uploadImage } from '../utils/image';

export default function Admin() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'settings' | 'schedule' | 'challenges' | 'store' | 'operation' | 'ranking'>('users');
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
    announcements: [],
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
  const [clans, setClans] = useState<Clan[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [uploading, setUploading] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

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
    difficulty: 'easy'
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

  const [isManageUsersOpen, setIsManageUsersOpen] = useState(false);
  const [openSections, setOpenSections] = useState<string[]>([]);

  const toggleSection = (section: string) => {
    setOpenSections(prev => 
      prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
    );
  };

  const fetchAll = async () => {
    // Fetch Users
    const { data: usersData } = await supabase.from('profiles').select('*, checkins(*)');
    if (usersData) {
      const mappedUsers = usersData.map((u: any) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        status: u.status,
        xp: u.xp || 0,
        coins: u.coins || 0,
        level: u.level || 1,
        avatar: {
          equipped: u.avatar_equipped,
          inventory: u.avatar_inventory || []
        },
        checkins: (u.checkins || []).map((c: any) => ({
          date: c.date,
          timestamp: c.timestamp,
          classTime: c.class_time
        })),
        paidBonuses: u.paid_bonuses || [],
        createdAt: u.created_at
      }));
      setUsers(mappedUsers);
      const roles: Record<string, string> = {};
      mappedUsers.forEach((u: User) => {
        roles[u.id] = u.role;
      });
      setSelectedRoles(roles);
    }

    // Fetch Box Settings
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
        announcements: settingsData.announcements || prev.announcements,
        timezone: settingsData.timezone || prev.timezone,
        max_clan_members: settingsData.max_clan_members || 10
      }));
    }

    // Fetch Schedule
    const { data: scheduleData } = await supabase.from('schedule').select('*').order('time', { ascending: true });
    if (scheduleData) {
      const mappedSchedule = scheduleData.map((s: any) => ({
        id: s.id,
        time: s.time,
        endTime: s.end_time,
        coach: s.coach,
        capacity: s.capacity,
        days: s.days,
        isActive: s.is_active,
        checkinWindowMinutes: s.checkin_window_minutes
      }));
      setSchedule(mappedSchedule);
    }

    // Fetch Challenges
    const { data: challengesData } = await supabase.from('challenges').select('*').order('created_at', { ascending: false });
    if (challengesData) setChallenges(challengesData);

    // Fetch Items
    const { data: itemsData } = await supabase.from('items').select('*');
    if (itemsData) setItems(itemsData);

    // Fetch Duels
    const { data: duelsData } = await supabase.from('duels').select('*').order('created_at', { ascending: false });
    if (duelsData) setDuels(duelsData);

    // Fetch WODs
    const { data: wodsData } = await supabase.from('wods').select('*').order('date', { ascending: false });
    if (wodsData) setWods(wodsData);

    // Fetch Clans
    const { data: clansData } = await supabase.from('clans').select('*').eq('is_active', true);
    if (clansData) setClans(clansData);
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleStatusChange = async (userId: string, status: string) => {
    const role = selectedRoles[userId] || 'athlete';
    const { error } = await supabase
      .from('profiles')
      .update({ status, role })
      .eq('id', userId);
    
    if (!error) {
      // Atualizar o estado local imediatamente
      setUsers(users.map(u => u.id === userId ? { ...u, status: status as any, role: role as any } : u));
      alert(`Usuário ${status === 'approved' ? 'aprovado' : status === 'rejected' ? 'rejeitado' : 'atualizado'} com sucesso!`);
    } else {
      alert('Erro ao atualizar status: ' + error.message);
    }
  };

  const handleRoleChange = (userId: string, role: string) => {
    setSelectedRoles(prev => ({ ...prev, [userId]: role }));
  };

  const handleRoleUpdate = async (userId: string) => {
    const role = selectedRoles[userId] || 'athlete';
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    const { error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', userId);
    
    if (!error) {
      setUsers(users.map(u => u.id === userId ? { ...u, role: role as any } : u));
      alert('Cargo atualizado com sucesso!');
    } else {
      alert('Erro ao atualizar cargo: ' + error.message);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'logo' | 'institutionalPhoto' | 'topBanner') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(field);
    try {
      const fileName = `${field}_${Date.now()}.jpg`;
      const publicUrl = await uploadImage(file, 'box-assets', fileName);
      setSettings(s => ({ ...s, [field]: publicUrl }));
    } catch (error: any) {
      alert('Erro ao fazer upload: ' + error.message);
    } finally {
      setUploading(null);
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    const { data, error } = await supabase
      .from('box_settings')
      .update({
        name: settings.name,
        logo: settings.logo,
        description: settings.description,
        institutional_photo: settings.institutionalPhoto,
        top_banner: settings.topBanner,
        lat: settings.location.lat,
        lng: settings.location.lng,
        radius: settings.radius,
        tv_layout: settings.tvLayout,
        tv_config: settings.tvConfig,
        rewards: settings.rewards,
        modules: settings.modules,
        announcements: settings.announcements,
        timezone: settings.timezone,
        max_clan_members: settings.max_clan_members
      })
      .eq('id', (settings as any).id);

    if (!error) {
      alert('Configurações salvas com sucesso!');
    } else {
      alert('Erro ao salvar: ' + error.message);
    }
  };

  const handleAddChallenge = async () => {
    if (!newChallenge.title || !newChallenge.description) {
      alert('Preencha todos os campos obrigatórios');
      return;
    }

    const { error } = await supabase.from('challenges').insert({
      title: newChallenge.title,
      description: newChallenge.description,
      active: newChallenge.active,
      start_date: newChallenge.startDate,
      end_date: newChallenge.endDate,
      xp: newChallenge.xp,
      coins: newChallenge.coins,
      repeatable: newChallenge.repeatable,
      daily_limit: newChallenge.dailyLimit,
      difficulty: newChallenge.difficulty
    });

    if (!error) {
      setNewChallenge({
        title: '',
        description: '',
        active: true,
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(new Date(new Date().setDate(new Date().getDate() + 7)), 'yyyy-MM-dd'),
        xp: 50,
        coins: 10,
        repeatable: false,
        dailyLimit: 1,
        difficulty: 'easy'
      });
      alert('Desafio criado com sucesso!');
      fetchAll();
    } else {
      alert('Erro ao criar desafio: ' + error.message);
    }
  };

  const handleAddSchedule = async () => {
    if (!newSchedule.time || !newSchedule.endTime || !newSchedule.coach) {
      alert('Preencha todos os campos obrigatórios');
      return;
    }

    const { error } = await supabase.from('schedule').insert({
      time: newSchedule.time,
      end_time: newSchedule.endTime,
      coach: newSchedule.coach,
      capacity: newSchedule.capacity,
      days: newSchedule.days,
      is_active: newSchedule.isActive,
      checkin_window_minutes: newSchedule.checkinWindowMinutes
    });

    if (!error) {
      setNewSchedule({ 
        time: '', 
        endTime: '', 
        coach: '', 
        capacity: 20,
        days: [1,2,3,4,5],
        isActive: true,
        checkinWindowMinutes: 60
      });
      alert('Horário adicionado com sucesso!');
      fetchAll();
    } else {
      alert('Erro ao adicionar horário: ' + error.message);
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!confirm('Tem certeza que deseja excluir este horário?')) return;

    const { error } = await supabase
      .from('schedule')
      .delete()
      .eq('id', scheduleId);

    if (!error) {
      alert('Horário excluído com sucesso!');
      fetchAll();
    } else {
      alert('Erro ao excluir horário: ' + error.message);
    }
  };

  const handleAddItem = async () => {
    if (!newItem.id || !newItem.name) {
      alert('Preencha todos os campos obrigatórios');
      return;
    }

    const { error } = await supabase.from('items').insert({
      id: newItem.id,
      name: newItem.name,
      slot: newItem.slot,
      price: newItem.price,
      image: newItem.image
    });

    if (!error) {
      setNewItem({
        id: '',
        name: '',
        slot: 'top',
        price: 100,
        image: ''
      });
      alert('Item adicionado com sucesso!');
      fetchAll();
    } else {
      alert('Erro ao adicionar item: ' + error.message);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Tem certeza que deseja excluir este item?')) return;

    const { error } = await supabase
      .from('items')
      .delete()
      .eq('id', itemId);

    if (!error) {
      alert('Item excluído com sucesso!');
      fetchAll();
    } else {
      alert('Erro ao excluir item: ' + error.message);
    }
  };

  const handleDeleteClan = async (clanId: string) => {
    if (!confirm('Tem certeza que deseja excluir este time permanentemente?')) return;
    
    const { error } = await supabase
      .from('clans')
      .delete()
      .eq('id', clanId);
    
    if (!error) {
      alert('Time excluído com sucesso!');
      fetchAll();
    } else {
      alert('Erro ao excluir time: ' + error.message);
    }
  };

  const handleSystemReset = async () => {
    const confirmation = prompt('AVISO CRÍTICO: Isso apagará TODOS os check-ins, resultados de WOD, histórico de recompensas, duelos e resetará o XP/Coins de todos os usuários. Digite "RESETAR" para confirmar:');
    
    if (confirmation !== 'RESETAR') return;

    try {
      // 1. Delete history tables
      await supabase.from('checkins').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('reward_history').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('wod_results').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('duels').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('domination_events').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      // 2. Reset user profiles
      await supabase
        .from('profiles')
        .update({ xp: 0, coins: 100, level: 1 })
        .neq('role', 'admin');

      alert('Sistema resetado com sucesso! O box está limpo para um novo começo.');
      fetchAll();
    } catch (err: any) {
      alert('Erro durante o reset: ' + err.message);
    }
  };

  const handleUpdateWod = async () => {
    if (!editingWod) return;
    const { error } = await supabase
      .from('wods')
      .update({
        name: editingWod.name,
        type: editingWod.type,
        warmup: editingWod.warmup,
        skill: editingWod.skill,
        rx: editingWod.rx,
        scaled: editingWod.scaled,
        beginner: editingWod.beginner,
        date: editingWod.date
      })
      .eq('id', editingWod.id);

    if (!error) {
      setWods(wods.map(w => w.id === editingWod.id ? editingWod : w));
      setEditingWod(null);
      alert('WOD atualizado com sucesso!');
    } else {
      alert('Erro ao atualizar WOD: ' + error.message);
    }
  };

  // Filtros de usuários
  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesStatus && matchesRole;
  });

  // Usuários pendentes de aprovação
  const pendingUsers = users.filter(u => {
    // IMPORTANTE: Ignoramos o statusFilter aqui para sempre mostrar pendentes na seção de solicitações
    const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    
    // Garantimos que o status seja exatamente 'pending'
    return matchesSearch && matchesRole && (u.status === 'pending' || !u.status);
  });

  // Usuários aprovados
  const approvedUsers = users.filter(u => u.status === 'approved');

  // Ranking de frequência incluindo todos os usuários aprovados com seus check-ins
  const historicalFrequencyRanking = approvedUsers.map(u => {
    const periodCheckins = u.checkins.filter(c => {
      const checkinDate = new Date(c.date + 'T12:00:00');
      return checkinDate.getMonth() === selectedMonth && checkinDate.getFullYear() === selectedYear;
    });
    return {
      ...u,
      periodCount: periodCheckins.length
    };
  }).sort((a, b) => b.periodCount - a.periodCount);

  const rejectedUsers = filteredUsers.filter(u => u.status === 'rejected');

  return (
    <div className="w-full min-h-screen bg-background text-on-surface">
      {/* Header */}
      <div className="bg-surface-container-low border-b border-outline-variant/10 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-xl">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="font-headline font-black text-xl text-on-surface uppercase italic">Painel de Admin</h1>
              <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Gerenciamento Completo do Box</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4 flex gap-2 overflow-x-auto no-scrollbar pb-4">
          {(['users', 'schedule', 'challenges', 'store', 'settings', 'operation', 'ranking'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-2 rounded-xl font-headline font-bold text-xs uppercase tracking-widest transition-all whitespace-nowrap",
                activeTab === tab
                  ? "bg-primary text-background"
                  : "bg-surface-container-highest text-on-surface-variant hover:bg-surface-container-highest/80"
              )}
            >
              {tab === 'users' && <Users className="w-4 h-4 inline mr-2" />}
              {tab === 'schedule' && <Calendar className="w-4 h-4 inline mr-2" />}
              {tab === 'challenges' && <Trophy className="w-4 h-4 inline mr-2" />}
              {tab === 'store' && <ShoppingBag className="w-4 h-4 inline mr-2" />}
              {tab === 'settings' && <Settings className="w-4 h-4 inline mr-2" />}
              {tab === 'operation' && <Tv className="w-4 h-4 inline mr-2" />}
              {tab === 'ranking' && <Activity className="w-4 h-4 inline mr-2" />}
              {tab === 'users' ? 'Usuários' : tab === 'schedule' ? 'Grade' : tab === 'challenges' ? 'Desafios' : tab === 'store' ? 'Loja' : tab === 'settings' ? 'Config' : tab === 'operation' ? 'Operação' : 'Ranking'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {activeTab === 'users' && (
            <motion.div
              key="users"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="flex flex-col gap-4"
            >
              {/* Search and Filters */}
              <div className="bg-surface-container-low p-4 rounded-3xl border border-outline-variant/10 space-y-4">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                  <input
                    type="text"
                    placeholder="BUSCAR POR NOME OU EMAIL..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-surface-container-highest border-none rounded-2xl pl-12 pr-4 py-4 font-headline font-bold text-on-surface text-xs uppercase tracking-widest"
                  />
                </div>
                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                  <div className="flex items-center gap-2 bg-surface-container-highest px-3 py-2 rounded-xl border border-outline-variant/10">
                    <Filter className="w-3 h-3 text-primary" />
                    <select 
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest focus:ring-0 p-0"
                    >
                      <option value="all">TODOS STATUS</option>
                      <option value="pending">PENDENTES</option>
                      <option value="approved">APROVADOS</option>
                      <option value="rejected">REJEITADOS</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2 bg-surface-container-highest px-3 py-2 rounded-xl border border-outline-variant/10">
                    <Shield className="w-3 h-3 text-primary" />
                    <select 
                      value={roleFilter}
                      onChange={(e) => setRoleFilter(e.target.value)}
                      className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest focus:ring-0 p-0"
                    >
                      <option value="all">TODAS FUNÇÕES</option>
                      <option value="athlete">ALUNOS</option>
                      <option value="coach">COACHES</option>
                      <option value="admin">ADMINS</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center mb-2">
                <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic">SOLICITAÇÕES PENDENTES</h3>
                <span className="bg-secondary/20 text-secondary text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">{pendingUsers.length} PENDENTES</span>
              </div>

              <div className="space-y-3">
                {pendingUsers.length > 0 ? pendingUsers.map((u) => (
                  <div key={u.id} className="bg-surface-container-low p-4 rounded-3xl border border-outline-variant/10 flex flex-col gap-4">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface font-headline font-black text-xl">
                          {u.name[0]}
                        </div>
                        <div>
                          <p className="text-on-surface font-bold uppercase text-sm">{u.name}</p>
                          <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">{u.email}</p>
                          <div className="flex gap-2 mt-1">
                            <span className="bg-secondary/20 text-secondary text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">
                              PENDENTE
                            </span>
                            <span className="bg-surface-container-highest text-on-surface-variant text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">
                              {u.role === 'admin' ? 'ADMIN' : u.role === 'coach' ? 'COACH' : 'ALUNO'}
                            </span>
                          </div>
                          <div className="mt-3 flex flex-col gap-2">
                            <label className="text-[8px] text-on-surface-variant font-bold uppercase tracking-widest">DEFINIR CARGO:</label>
                            <div className="flex gap-2">
                              {(['athlete', 'coach', 'admin'] as const).map((role) => (
                                <button
                                  key={role}
                                  onClick={() => handleRoleChange(u.id, role)}
                                  className={cn(
                                    "px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all border",
                                    selectedRoles[u.id] === role 
                                      ? "bg-primary text-background border-primary" 
                                      : "bg-surface-container-highest text-on-surface-variant border-outline-variant/20"
                                  )}
                                >
                                  {role === 'admin' ? 'ADMIN' : role === 'coach' ? 'COACH' : 'ALUNO'}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 self-end sm:self-start">
                        <button onClick={() => handleStatusChange(u.id, 'approved')} className="p-2 bg-primary/20 text-primary rounded-xl hover:bg-primary hover:text-background transition-all">
                          <Check className="w-5 h-5" />
                        </button>
                        <button onClick={() => handleStatusChange(u.id, 'rejected')} className="p-2 bg-error-container text-on-error-container rounded-xl hover:bg-error hover:text-on-error transition-all">
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="bg-surface-container-low p-8 rounded-3xl border border-outline-variant/10 text-center">
                    <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest opacity-50 italic">Nenhuma solicitação pendente</p>
                  </div>
                )}
              </div>

              {/* Manage Approved Users Section */}
              <div className="mt-6">
                <button 
                  onClick={() => setIsManageUsersOpen(!isManageUsersOpen)}
                  className="w-full flex justify-between items-center bg-surface-container-low p-6 rounded-3xl border border-outline-variant/10 group hover:border-primary/30 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-2 rounded-xl transition-colors",
                      isManageUsersOpen ? "bg-primary/20 text-primary" : "bg-surface-container-highest text-on-surface-variant"
                    )}>
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
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-4 space-y-3">
                        {approvedUsers.length > 0 ? approvedUsers.map((u) => (
                          <div key={u.id} className="bg-surface-container-low p-4 rounded-3xl border border-outline-variant/10 flex flex-col gap-4">
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-headline font-black text-xl">
                                  {u.name[0]}
                                </div>
                                <div>
                                  <p className="text-on-surface font-bold uppercase text-sm">{u.name}</p>
                                  <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">{u.email}</p>
                                  <div className="mt-3 flex flex-col gap-2">
                                    <label className="text-[8px] text-on-surface-variant font-bold uppercase tracking-widest">ALTERAR CARGO:</label>
                                    <div className="flex gap-2">
                                      {(['athlete', 'coach', 'admin'] as const).map((role) => (
                                        <button
                                          key={role}
                                          onClick={() => handleRoleChange(u.id, role)}
                                          className={cn(
                                            "px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all border",
                                            selectedRoles[u.id] === role 
                                              ? "bg-primary text-background border-primary" 
                                              : "bg-surface-container-highest text-on-surface-variant border-outline-variant/20"
                                          )}
                                        >
                                          {role === 'admin' ? 'ADMIN' : role === 'coach' ? 'COACH' : 'ALUNO'}
                                        </button>
                                      ))}
                                      {selectedRoles[u.id] !== u.role && (
                                        <button 
                                          onClick={() => handleRoleUpdate(u.id)}
                                          className="px-3 py-1 bg-secondary text-background rounded-lg text-[8px] font-black uppercase tracking-widest animate-pulse"
                                        >
                                          SALVAR
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )) : (
                          <div className="text-center py-8 opacity-50">
                            <p className="text-[10px] font-bold uppercase tracking-widest">Nenhum usuário aprovado</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="flex flex-col gap-6"
            >
              {/* Box Info Section */}
              <div className="bg-surface-container-low p-6 rounded-[2rem] border border-outline-variant/10 space-y-4">
                <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic">INFORMAÇÕES DO BOX</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Nome do Box</label>
                    <input 
                      type="text" 
                      value={settings.name} 
                      onChange={e => setSettings({...settings, name: e.target.value})}
                      className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Descrição</label>
                    <textarea 
                      value={settings.description} 
                      onChange={e => setSettings({...settings, description: e.target.value})}
                      className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface min-h-24 resize-none" 
                    />
                  </div>
                </div>
              </div>

              {/* Media Section */}
              <div className="bg-surface-container-low p-6 rounded-[2rem] border border-outline-variant/10 space-y-4">
                <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-primary" /> MÍDIA
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {['logo', 'institutionalPhoto', 'topBanner'].map(field => (
                    <div key={field} className="space-y-2">
                      <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">
                        {field === 'logo' ? 'Logo' : field === 'institutionalPhoto' ? 'Foto Institucional' : 'Banner Topo'}
                      </label>
                      <div className="relative">
                        <input 
                          type="file" 
                          accept="image/*"
                          onChange={e => handleFileUpload(e, field as any)}
                          className="hidden"
                          id={`upload-${field}`}
                        />
                        <label 
                          htmlFor={`upload-${field}`}
                          className="flex items-center justify-center w-full h-32 bg-surface-container-highest rounded-2xl border-2 border-dashed border-outline-variant/20 cursor-pointer hover:border-primary/50 transition-all"
                        >
                          <div className="text-center">
                            <Camera className="w-6 h-6 text-on-surface-variant mx-auto mb-1" />
                            <p className="text-[8px] text-on-surface-variant font-bold uppercase tracking-widest">
                              {uploading === field ? 'Enviando...' : 'Clique para enviar'}
                            </p>
                          </div>
                        </label>
                      </div>
                      {(settings as any)[field] && (
                        <img src={(settings as any)[field]} alt={field} className="w-full h-20 object-cover rounded-xl" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Rewards Section */}
              <div className="bg-surface-container-low p-6 rounded-[2rem] border border-outline-variant/10 space-y-4">
                <button 
                  onClick={() => toggleSection('rewards')}
                  className="w-full flex justify-between items-center p-4 bg-surface-container-low rounded-2xl border border-outline-variant/10"
                >
                  <h3 className="font-headline font-bold text-sm text-on-surface uppercase italic">RECOMPENSAS POR CHECK-IN</h3>
                  {openSections.includes('rewards') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>

                <AnimatePresence>
                  {openSections.includes('rewards') && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden px-2 space-y-4"
                    >
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">XP por Check-in</label>
                          <input 
                            type="number" 
                            value={settings.rewards.xp_per_checkin} 
                            onChange={e => {
                              const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                              setSettings(s => ({...s, rewards: {...s.rewards, xp_per_checkin: val}}));
                            }}
                            className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" 
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">BrazaCoins por Check-in</label>
                          <input 
                            type="number" 
                            value={settings.rewards.coins_per_checkin} 
                            onChange={e => {
                              const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                              setSettings(s => ({...s, rewards: {...s.rewards, coins_per_checkin: val}}));
                            }}
                            className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" 
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Challenges Section */}
              <div className="space-y-4 border-t border-outline-variant/10 pt-6">
                <button 
                  onClick={() => toggleSection('challenges')}
                  className="w-full flex justify-between items-center p-4 bg-surface-container-low rounded-2xl border border-outline-variant/10"
                >
                  <h3 className="font-headline font-bold text-sm text-on-surface uppercase italic">RECOMPENSAS POR DESAFIO</h3>
                  {openSections.includes('challenges') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>

                <AnimatePresence>
                  {openSections.includes('challenges') && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden px-2 space-y-4"
                    >
                      {(['easy', 'medium', 'hard', 'special'] as const).map(diff => (
                        <div key={diff} className="p-4 bg-surface-container-highest/30 rounded-2xl border border-outline-variant/10 space-y-3">
                          <div className="text-[10px] text-primary font-black uppercase tracking-widest">DESAFIO {diff === 'easy' ? 'FÁCIL' : diff === 'medium' ? 'MÉDIO' : diff === 'hard' ? 'DIFÍCIL' : 'ESPECIAL'}</div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-[8px] text-on-surface-variant font-bold uppercase tracking-widest">XP</label>
                              <input 
                                type="number" 
                                value={(settings.rewards as any)[`challenge_${diff}_xp`]} 
                                onChange={e => {
                                  const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                                  setSettings(s => ({...s, rewards: {...s.rewards, [`challenge_${diff}_xp`]: val}}));
                                }}
                                className="w-full bg-surface-container-highest border-none rounded-xl p-3 font-headline font-bold text-on-surface text-sm" 
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[8px] text-on-surface-variant font-bold uppercase tracking-widest">BrazaCoins</label>
                              <input 
                                type="number" 
                                value={(settings.rewards as any)[`challenge_${diff}_coins`]} 
                                onChange={e => {
                                  const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                                  setSettings(s => ({...s, rewards: {...s.rewards, [`challenge_${diff}_coins`]: val}}));
                                }}
                                className="w-full bg-surface-container-highest border-none rounded-xl p-3 font-headline font-bold text-on-surface text-sm" 
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Weekly Bonuses Section */}
              <div className="space-y-4 border-t border-outline-variant/10 pt-6">
                <button 
                  onClick={() => toggleSection('weekly')}
                  className="w-full flex justify-between items-center p-4 bg-surface-container-low rounded-2xl border border-outline-variant/10"
                >
                  <h3 className="font-headline font-bold text-sm text-on-surface uppercase italic">BÔNUS SEMANAIS (FREQUÊNCIA)</h3>
                  {openSections.includes('weekly') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>

                <AnimatePresence>
                  {openSections.includes('weekly') && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden px-2 space-y-4"
                    >
                      {[3, 4, 5, 6].map(count => (
                        <div key={count} className="grid grid-cols-2 gap-4 p-4 bg-surface-container-highest/30 rounded-2xl border border-outline-variant/10">
                          <div className="col-span-2 text-[10px] text-primary font-black uppercase tracking-widest">{count} CHECK-INS NA SEMANA</div>
                          <div className="space-y-2">
                            <label className="text-[8px] text-on-surface-variant font-bold uppercase tracking-widest">XP Bônus</label>
                            <input 
                              type="number" 
                              value={(settings.rewards as any)[`weekly_bonus_${count}_xp`]} 
                              onChange={e => {
                                const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                                setSettings(s => ({...s, rewards: {...s.rewards, [`weekly_bonus_${count}_xp`]: val}}));
                              }}
                              className="w-full bg-surface-container-highest border-none rounded-xl p-3 font-headline font-bold text-on-surface text-sm" 
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[8px] text-on-surface-variant font-bold uppercase tracking-widest">BrazaCoins Bônus</label>
                            <input 
                              type="number" 
                              value={(settings.rewards as any)[`weekly_bonus_${count}_coins`]} 
                              onChange={e => {
                                const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                                setSettings(s => ({...s, rewards: {...s.rewards, [`weekly_bonus_${count}_coins`]: val}}));
                              }}
                              className="w-full bg-surface-container-highest border-none rounded-xl p-3 font-headline font-bold text-on-surface text-sm" 
                            />
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Other Rewards Section */}
              <div className="space-y-4 border-t border-outline-variant/10 pt-6">
                <button 
                  onClick={() => toggleSection('other')}
                  className="w-full flex justify-between items-center p-4 bg-surface-container-low rounded-2xl border border-outline-variant/10"
                >
                  <h3 className="font-headline font-bold text-sm text-on-surface uppercase italic">OUTRAS RECOMPENSAS</h3>
                  {openSections.includes('other') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>

                <AnimatePresence>
                  {openSections.includes('other') && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden px-2 space-y-4"
                    >
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">BrazaCoins por Level Up</label>
                          <input 
                            type="number" 
                            value={settings.rewards.level_up_bonus_coins} 
                            onChange={e => {
                              const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                              setSettings(s => ({...s, rewards: {...s.rewards, level_up_bonus_coins: val}}));
                            }}
                            className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" 
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">XP por Derrota em Duelo</label>
                          <input 
                            type="number" 
                            value={settings.rewards.duel_loss_xp || 0} 
                            onChange={e => {
                              const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                              setSettings(s => ({...s, rewards: {...s.rewards, duel_loss_xp: val}}));
                            }}
                            className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" 
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Save Button */}
              <button 
                onClick={handleSaveSettings}
                className="w-full bg-primary text-background py-4 rounded-2xl font-headline font-black uppercase italic shadow-lg flex items-center justify-center gap-2 mt-6"
              >
                <Save className="w-5 h-5" /> SALVAR CONFIGURAÇÕES
              </button>
            </motion.div>
          )}

          {activeTab === 'challenges' && (
            <motion.div
              key="challenges"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="flex flex-col gap-6"
            >
              {/* Add Challenge Form */}
              <div className="bg-surface-container-low p-6 rounded-[2rem] border border-outline-variant/10 space-y-4">
                <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic">CRIAR NOVO DESAFIO</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Título</label>
                      <input 
                        type="text" 
                        value={newChallenge.title} 
                        onChange={e => setNewChallenge({...newChallenge, title: e.target.value})}
                        className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Dificuldade</label>
                      <select 
                        value={newChallenge.difficulty} 
                        onChange={e => setNewChallenge({...newChallenge, difficulty: e.target.value})}
                        className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface appearance-none cursor-pointer"
                      >
                        <option value="easy">Fácil</option>
                        <option value="medium">Médio</option>
                        <option value="hard">Difícil</option>
                        <option value="special">Especial</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Descrição</label>
                    <textarea 
                      value={newChallenge.description} 
                      onChange={e => setNewChallenge({...newChallenge, description: e.target.value})}
                      className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface min-h-20 resize-none" 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Data Início</label>
                      <input 
                        type="date" 
                        value={newChallenge.startDate} 
                        onChange={e => setNewChallenge({...newChallenge, startDate: e.target.value})}
                        className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Data Fim</label>
                      <input 
                        type="date" 
                        value={newChallenge.endDate} 
                        onChange={e => setNewChallenge({...newChallenge, endDate: e.target.value})}
                        className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" 
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">XP</label>
                      <input 
                        type="number" 
                        value={newChallenge.xp} 
                        onChange={e => setNewChallenge({...newChallenge, xp: parseInt(e.target.value) || 0})}
                        className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">BrazaCoins</label>
                      <input 
                        type="number" 
                        value={newChallenge.coins} 
                        onChange={e => setNewChallenge({...newChallenge, coins: parseInt(e.target.value) || 0})}
                        className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" 
                      />
                    </div>
                  </div>
                </div>
                <button 
                  onClick={handleAddChallenge}
                  className="w-full bg-primary text-background py-4 rounded-2xl font-headline font-black uppercase italic shadow-lg flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" /> CRIAR DESAFIO
                </button>
              </div>

              {/* Challenges List */}
              <div className="space-y-3">
                <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic">DESAFIOS ATIVOS</h3>
                {challenges.map((c) => (
                  <div key={c.id} className="bg-surface-container-low p-4 rounded-3xl border border-outline-variant/10">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="text-on-surface font-bold uppercase text-sm italic">{c.title}</p>
                        <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest mt-1">{c.description}</p>
                      </div>
                      <span className={cn(
                        "text-[8px] font-black px-2 py-1 rounded-full uppercase tracking-widest",
                        c.active ? "bg-primary/20 text-primary" : "bg-error-container text-on-error-container"
                      )}>
                        {c.active ? 'ATIVO' : 'INATIVO'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-outline-variant/10">
                      <div className="flex gap-3">
                        <span className="text-[10px] font-black text-primary uppercase tracking-widest">{c.xp} XP</span>
                        <span className="text-[10px] font-black text-secondary uppercase tracking-widest">{c.coins} COINS</span>
                      </div>
                      <span className="text-[8px] text-on-surface-variant font-bold uppercase tracking-widest">
                        {format(new Date(c.start_date), 'dd/MM')} - {format(new Date(c.end_date), 'dd/MM')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'schedule' && (
            <motion.div
              key="schedule"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="flex flex-col gap-6"
            >
              {/* Add Schedule Form */}
              <div className="bg-surface-container-low p-6 rounded-[2rem] border border-outline-variant/10 space-y-4">
                <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic">ADICIONAR HORÁRIO</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Início</label>
                    <input 
                      type="time" 
                      value={newSchedule.time} 
                      onChange={e => setNewSchedule({...newSchedule, time: e.target.value})}
                      className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Fim</label>
                    <input 
                      type="time" 
                      value={newSchedule.endTime} 
                      onChange={e => setNewSchedule({...newSchedule, endTime: e.target.value})}
                      className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" 
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Coach</label>
                    <select 
                      value={newSchedule.coach} 
                      onChange={e => setNewSchedule({...newSchedule, coach: e.target.value})}
                      className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface appearance-none cursor-pointer" 
                    >
                      <option value="" className="bg-surface-container-highest">Selecionar Coach</option>
                      {users
                        .filter(u => u.role === 'coach' || u.role === 'admin')
                        .map(coach => (
                          <option key={coach.id} value={coach.name} className="bg-surface-container-highest">
                            {coach.name} ({coach.role === 'admin' ? 'Head' : 'Coach'})
                          </option>
                        ))
                      }
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Capacidade</label>
                    <input 
                      type="number" 
                      value={newSchedule.capacity} 
                      onChange={e => {
                        const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                        setNewSchedule({...newSchedule, capacity: val});
                      }}
                      className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" 
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Janela de Check-in (minutos antes)</label>
                  <input 
                    type="number" 
                    value={newSchedule.checkinWindowMinutes} 
                    onChange={e => {
                      const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                      setNewSchedule({...newSchedule, checkinWindowMinutes: val});
                    }}
                    className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Dias da Semana</label>
                  <div className="flex gap-2 flex-wrap">
                    {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          const days = newSchedule.days || [];
                          const newDays = days.includes(idx) ? days.filter(d => d !== idx) : [...days, idx];
                          setNewSchedule({...newSchedule, days: newDays});
                        }}
                        className={cn(
                          "w-10 h-10 rounded-xl font-headline font-bold text-xs transition-all border",
                          newSchedule.days?.includes(idx) 
                            ? "bg-primary text-background border-primary" 
                            : "bg-surface-container-highest text-on-surface-variant border-outline-variant/10"
                        )}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
                <button 
                  onClick={handleAddSchedule}
                  className="w-full bg-primary text-background py-4 rounded-2xl font-headline font-black uppercase italic shadow-lg flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" /> ADICIONAR HORÁRIO
                </button>
              </div>

              {/* Schedule List */}
              <div className="space-y-3">
                <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic">GRADE ATUAL</h3>
                {schedule.map((s) => (
                  <div key={s.id} className="bg-surface-container-low p-4 rounded-3xl border border-outline-variant/10 flex justify-between items-center group hover:border-primary/30 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-primary/10 rounded-2xl">
                        <Clock className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-on-surface font-bold uppercase text-sm italic">{s.time} - {s.endTime}</p>
                          {!s.isActive && <span className="bg-error-container text-on-error-container text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">INATIVO</span>}
                        </div>
                        <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">Coach: {s.coach} • Cap: {s.capacity}</p>
                        <div className="flex gap-1 mt-1">
                          {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, idx) => (
                            <span key={idx} className={cn(
                              "text-[8px] font-black w-4 h-4 flex items-center justify-center rounded-sm",
                              s.days?.includes(idx) ? "bg-primary/20 text-primary" : "bg-surface-container-highest text-on-surface-variant opacity-30"
                            )}>
                              {day}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => s.id && handleDeleteSchedule(s.id)} className="p-2 text-on-surface-variant hover:text-error transition-colors opacity-0 group-hover:opacity-100">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'store' && (
            <motion.div
              key="store"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="flex flex-col gap-6"
            >
              <div className="bg-surface-container-low p-6 rounded-[2rem] border border-outline-variant/10 space-y-4">
                <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-primary" /> ADICIONAR ITEM NA LOJA
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">ID do Item</label>
                    <input 
                      type="text" 
                      value={newItem.id} 
                      onChange={e => setNewItem({...newItem, id: e.target.value})}
                      placeholder="ex: cap_red"
                      className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Nome</label>
                    <input 
                      type="text" 
                      value={newItem.name} 
                      onChange={e => setNewItem({...newItem, name: e.target.value})}
                      placeholder="ex: Boné Vermelho"
                      className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" 
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Slot</label>
                    <select 
                      value={newItem.slot} 
                      onChange={e => setNewItem({...newItem, slot: e.target.value as any})}
                      className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface appearance-none cursor-pointer"
                    >
                      <option value="top">Top</option>
                      <option value="bottom">Bottom</option>
                      <option value="left">Left</option>
                      <option value="right">Right</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Preço (BrazaCoins)</label>
                    <input 
                      type="number" 
                      value={newItem.price} 
                      onChange={e => setNewItem({...newItem, price: parseInt(e.target.value) || 0})}
                      className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" 
                    />
                  </div>
                </div>
                <button 
                  onClick={handleAddItem}
                  className="w-full bg-primary text-background py-4 rounded-2xl font-headline font-black uppercase italic shadow-lg flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" /> ADICIONAR ITEM
                </button>
              </div>

              {/* Items List */}
              <div className="space-y-3">
                <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic">ITENS NA LOJA</h3>
                {items.map((item) => (
                  <div key={item.id} className="bg-surface-container-low p-4 rounded-3xl border border-outline-variant/10 flex justify-between items-center group hover:border-primary/30 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-primary/10 rounded-2xl">
                        <ShoppingBag className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="text-on-surface font-bold uppercase text-sm italic">{item.name}</p>
                        <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">ID: {item.id} • Slot: {item.slot} • {item.price} BrazaCoins</p>
                      </div>
                    </div>
                    <button onClick={() => handleDeleteItem(item.id)} className="p-2 text-on-surface-variant hover:text-error transition-colors opacity-0 group-hover:opacity-100">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'ranking' && (
            <motion.div
              key="ranking"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="flex flex-col gap-6"
            >
              <div className="bg-surface-container-low p-6 rounded-[2rem] border border-outline-variant/10 space-y-6">
                <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" /> MONITORAMENTO DE PRESENÇA
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-surface-container-highest/30 p-4 rounded-2xl border border-outline-variant/10 text-center">
                    <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest mb-1">Check-ins Hoje</p>
                    <p className="text-3xl font-headline font-black text-primary italic">24</p>
                  </div>
                  <div className="bg-surface-container-highest/30 p-4 rounded-2xl border border-outline-variant/10 text-center">
                    <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest mb-1">Média Semanal</p>
                    <p className="text-3xl font-headline font-black text-secondary italic">18</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h4 className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">AÇÕES DE MANUTENÇÃO</h4>
                    <button 
                      onClick={handleSystemReset}
                      className="bg-error-container text-on-error-container px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest"
                    >
                      RESETAR SISTEMA (LIMPEZA GERAL)
                    </button>
                  </div>

                  <div className="space-y-4 border-t border-outline-variant/10 pt-6">
                    <h4 className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">GERENCIAR TIMES</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {clans.length > 0 ? clans.map(clan => (
                        <div key={clan.id} className="flex items-center justify-between p-3 bg-surface-container-highest/20 rounded-xl border border-outline-variant/5">
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: clan.color }}></div>
                            <p className="text-xs font-bold text-on-surface uppercase">{clan.name}</p>
                          </div>
                          <button 
                            onClick={() => handleDeleteClan(clan.id)}
                            className="p-2 text-error hover:bg-error/10 rounded-lg transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )) : (
                        <p className="text-[10px] text-on-surface-variant italic">Nenhum time ativo encontrado.</p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-t border-outline-variant/10 pt-6">
                    <h4 className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">RANKING DE FREQUÊNCIA (PERÍODO)</h4>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <select 
                        value={selectedMonth} 
                        onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                        className="flex-1 sm:flex-none bg-surface-container-highest border-none rounded-xl px-3 py-2 text-[10px] font-bold text-on-surface uppercase tracking-widest outline-none"
                      >
                        {['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'].map((m, i) => (
                          <option key={i} value={i}>{m}</option>
                        ))}
                      </select>
                      <select 
                        value={selectedYear} 
                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                        className="flex-1 sm:flex-none bg-surface-container-highest border-none rounded-xl px-3 py-2 text-[10px] font-bold text-on-surface uppercase tracking-widest outline-none"
                      >
                        {[2024, 2025, 2026].map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {historicalFrequencyRanking.length > 0 ? historicalFrequencyRanking.map((u, idx) => (
                      <div key={u.id} className="flex items-center justify-between p-3 bg-surface-container-highest/20 rounded-xl border border-outline-variant/5">
                        <div className="flex items-center gap-3">
                          <span className="w-5 text-[10px] font-black text-primary italic">#{idx + 1}</span>
                          <p className="text-xs font-bold text-on-surface uppercase">{u.name}</p>
                        </div>
                        <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">{u.periodCount} PRESENÇAS</span>
                      </div>
                    )) : (
                      <div className="text-center py-8 opacity-50">
                        <p className="text-[10px] font-bold uppercase tracking-widest">Nenhum check-in neste período</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
