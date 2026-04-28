import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Users, MapPin, Calendar, Megaphone, Plus, Settings, 
  ChevronRight, ChevronDown, Activity, Check, X, Shield, UserPlus, 
  ImageIcon, ShoppingBag, Tv, Trophy, History, Search, Filter,
  Clock, ToggleLeft, ToggleRight, Trash2, Edit2, Save, Camera
} from 'lucide-react';
import { cn } from '../lib/utils';
import { User, BoxSettings, Schedule, Item, Duel, Wod } from '../types';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { supabase } from '../lib/supabase';
import { uploadImage } from '../utils/image';

export default function Admin() {
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

  const toggleSection = (section: string) => {
    setOpenSections(prev => 
      prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
    );
  };

  const fetchAll = async () => {
    // Fetch Users
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
        announcements: (settingsData.announcements || prev.announcements || []) as any[],
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
      setUsers(users.map(u => u.id === userId ? { ...u, status: status as any, role: role as any } : u));
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
        institutional_photo: (settings as any).institutionalPhoto,
        top_banner: (settings as any).topBanner,
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
      .eq('id', (settings as any).id)
      .select()
      .maybeSingle();

    if (!error && data) {
      fetchAll();
      alert('Ajustes salvos com sucesso!');
    } else {
      alert('Erro ao salvar ajustes: ' + (error?.message || 'Erro desconhecido'));
    }
  };

    if (!error && data) {
      fetchAll();
      alert('Ajustes salvos com sucesso!');
    } else {
      alert('Erro ao salvar ajustes: ' + (error?.message || 'Erro desconhecido'));
    }
  };

  const handleAddSchedule = async () => {
    if (!newSchedule.time || !newSchedule.endTime || !newSchedule.coach) {
      alert('Por favor, preencha todos os campos obrigatórios: Início, Fim e Coach.');
      return;
    }
    const { data, error } = await supabase
      .from('schedule')
      .insert({
        time: newSchedule.time,
        end_time: newSchedule.endTime,
        coach: newSchedule.coach,
        capacity: newSchedule.capacity,
        days: newSchedule.days,
        is_active: newSchedule.isActive,
        checkin_window_minutes: newSchedule.checkinWindowMinutes
      })
      .select();

    if (!error && data) {
      const added = data[0];
      const mapped: Schedule = {
        id: added.id,
        time: added.time,
        endTime: added.end_time,
        coach: added.coach,
        capacity: added.capacity,
        days: added.days,
        isActive: added.is_active,
        checkinWindowMinutes: added.checkin_window_minutes
      };
      setSchedule([...schedule, mapped]);
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
    } else {
      alert('Erro ao adicionar horário: ' + (error?.message || 'Erro desconhecido'));
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    const { error } = await supabase
      .from('schedule')
      .delete()
      .eq('id', id);
    
    if (!error) {
      setSchedule(schedule.filter(s => s.id !== id));
    } else {
      alert('Erro ao excluir horário: ' + error.message);
    }
  };

  const handleAddChallenge = async () => {
    if (!newChallenge.title || !newChallenge.description) return;
    const { data, error } = await supabase
      .from('challenges')
      .insert({
        title: newChallenge.title,
        description: newChallenge.description,
        active: newChallenge.active,
        start_date: newChallenge.startDate,
        end_date: newChallenge.endDate,
        xp: newChallenge.xp,
        coins: newChallenge.coins,
        repeatable: newChallenge.repeatable,
        daily_limit: newChallenge.dailyLimit,
        difficulty: newChallenge.difficulty,
        required_days: newChallenge.required_days,
        require_photo: newChallenge.require_photo
      })
      .select();

    if (!error && data) {
      setChallenges([data[0], ...challenges]);
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
        difficulty: 'easy',
        required_days: 1,
        require_photo: false
      });
      alert('Desafio criado com sucesso!');
    } else {
      alert('Erro ao criar desafio: ' + (error?.message || 'Erro desconhecido'));
    }
  };

  const handleAddItem = async () => {
    if (!newItem.id || !newItem.name || !newItem.price) return;
    const { data, error } = await supabase
      .from('items')
      .insert({
        id: newItem.id,
        name: newItem.name,
        slot: newItem.slot,
        price: newItem.price,
        image: newItem.image
      })
      .select();

    if (!error && data) {
      setItems([data[0], ...items]);
      setNewItem({ id: '', name: '', slot: 'top', price: 100, image: '' });
    } else {
      alert('Erro ao adicionar item: ' + (error?.message || 'Erro desconhecido'));
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este item?')) return;
    const { error } = await supabase
      .from('items')
      .delete()
      .eq('id', id);
    
    if (!error) {
      setItems(items.filter(i => i.id !== id));
    } else {
      alert('Erro ao excluir item: ' + error.message);
    }
  };

  const handleUpdateItem = async () => {
    if (!editingItem) return;
    const { error } = await supabase
      .from('items')
      .update({
        name: editingItem.name,
        slot: editingItem.slot,
        price: editingItem.price,
        image: editingItem.image
      })
      .eq('id', editingItem.id);

    if (!error) {
      setItems(items.map(i => i.id === editingItem.id ? editingItem : i));
      setEditingItem(null);
      alert('Item atualizado com sucesso!');
    } else {
      alert('Erro ao atualizar item: ' + error.message);
    }
  };

  const handleEditChallenge = (challenge: any) => {
    setEditingChallenge({
      ...challenge,
      startDate: challenge.start_date,
      endDate: challenge.end_date
    });
    setIsEditingChallenge(true);
  };

  const handleUpdateChallenge = async () => {
    if (!editingChallenge || !editingChallenge.title || !editingChallenge.description) return;
    
    const { error } = await supabase
      .from('challenges')
      .update({
        title: editingChallenge.title,
        description: editingChallenge.description,
        active: editingChallenge.active,
        start_date: editingChallenge.startDate,
        end_date: editingChallenge.endDate,
        xp: editingChallenge.xp,
        coins: editingChallenge.coins,
        repeatable: editingChallenge.repeatable,
        daily_limit: editingChallenge.dailyLimit,
        difficulty: editingChallenge.difficulty,
        required_days: editingChallenge.required_days,
        require_photo: editingChallenge.require_photo
      })
      .eq('id', editingChallenge.id);

    if (!error) {
      setChallenges(challenges.map(c => c.id === editingChallenge.id ? editingChallenge : c));
      setEditingChallenge(null);
      setIsEditingChallenge(false);
      alert('Desafio atualizado com sucesso!');
    } else {
      alert('Erro ao atualizar desafio: ' + error.message);
    }
  };

  const handleDeleteChallenge = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este desafio permanentemente?')) return;
    
    const { error } = await supabase
      .from('challenges')
      .delete()
      .eq('id', id);
    
    if (!error) {
      setChallenges(challenges.filter(c => c.id !== id));
      alert('Desafio excluído com sucesso!');
    } else {
      alert('Erro ao excluir desafio: ' + error.message);
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

  const historicalFrequencyRanking = approvedUsers.map(u => {
    const periodCheckins = u.checkins.filter(c => {
      const checkinDate = new Date(c.date + 'T12:00:00'); // Use noon to avoid timezone shifts
      return checkinDate.getMonth() === selectedMonth && checkinDate.getFullYear() === selectedYear;
    });
    return {
      ...u,
      periodCount: periodCheckins.length
    };
  }).sort((a, b) => b.periodCount - a.periodCount);
  const rejectedUsers = filteredUsers.filter(u => u.status === 'rejected');

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
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 min-w-[100px] py-3 rounded-xl font-headline font-bold text-[10px] uppercase tracking-widest transition-all",
              activeTab === tab ? "bg-primary text-background shadow-lg" : "text-on-surface-variant hover:text-on-surface"
            )}
          >
            {tab === 'users' ? 'USUÁRIOS' : 
             tab === 'settings' ? 'BOX' : 
             tab === 'schedule' ? 'GRADE' : 
             tab === 'challenges' ? 'DESAFIOS' :
             tab === 'store' ? 'LOJA' :
             tab === 'operation' ? 'OPERAÇÃO' :
             tab === 'checkins' ? 'CHECK-INS' :
             'RANKING'}
          </button>
        ))}
      </div>

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
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant" />
                <input 
                  type="text" 
                  placeholder="BUSCAR POR NOME OU EMAIL..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-surface-container-highest border-none rounded-2xl py-4 pl-12 pr-4 font-headline font-bold text-xs text-on-surface placeholder:text-on-surface-variant/50"
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
              <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic">SOLICITAÇÕES</h3>
              <span className="bg-primary/20 text-primary text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">{pendingUsers.length} PENDENTES</span>
            </div>

            <div className="space-y-3">
              {pendingUsers.length > 0 ? pendingUsers.map((u) => (
                <div key={u.id} className="bg-surface-container-low p-4 rounded-3xl border border-outline-variant/10 flex flex-col gap-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface font-headline font-black text-xl">
                        {(u.name || 'S')[0]}
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
                                {(u.name || 'S')[0]}
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
                            <div className="flex gap-2">
                              <span className="bg-primary/20 text-primary text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest h-fit">
                                ATIVO
                              </span>
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

            {/* Rejected Users Section */}
            {rejectedUsers.length > 0 && (
              <div className="mt-6 space-y-3">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic">REJEITADOS</h3>
                  <span className="bg-error-container text-on-error-container text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">{rejectedUsers.length}</span>
                </div>
                {rejectedUsers.map((u) => (
                  <div key={u.id} className="bg-surface-container-low p-4 rounded-3xl border border-outline-variant/10 flex justify-between items-center opacity-60 grayscale">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface-variant font-headline font-black text-lg">
                        {(u.name || 'S')[0]}
                      </div>
                      <div>
                        <p className="text-on-surface font-bold uppercase text-xs">{u.name}</p>
                        <p className="text-on-surface-variant text-[8px] font-bold uppercase tracking-widest">{u.email}</p>
                      </div>
                    </div>
                    <button onClick={() => handleStatusChange(u.id, 'pending')} className="text-[8px] font-black text-primary uppercase tracking-widest hover:underline">
                      RECONSIDERAR
                    </button>
                  </div>
                ))}
              </div>
            )}
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
            <div className="bg-surface-container-low p-6 rounded-[2rem] border border-outline-variant/10 space-y-8">
              <div className="flex justify-between items-center">
                <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic">CONFIGURAÇÕES DO BOX</h3>
                <button 
                  onClick={handleSaveSettings}
                  className="bg-primary text-background px-6 py-2 rounded-xl font-headline font-black text-xs uppercase italic shadow-lg hover:scale-105 transition-transform flex items-center gap-2"
                >
                  <Save className="w-4 h-4" /> SALVAR ALTERAÇÕES
                </button>
              </div>

              {/* Basic Info Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-primary">
                  <Settings className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Informações Básicas</span>
                </div>
                <div className="grid grid-cols-1 gap-4">
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
                      rows={3}
                      className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface resize-none" 
                    />
                  </div>
                </div>
              </div>

              {/* Assets Section */}
              <div className="space-y-4 border-t border-outline-variant/10 pt-6">
                <div className="flex items-center gap-2 text-primary">
                  <ImageIcon className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Imagens e Identidade</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {/* Logo */}
                  <div className="space-y-3">
                    <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Logo do Box</label>
                    <div className="relative group aspect-square rounded-3xl bg-surface-container-highest overflow-hidden border-2 border-dashed border-outline-variant/20 flex items-center justify-center">
                      {settings.logo ? (
                        <img src={settings.logo} alt="Logo" className="w-full h-full object-contain p-4" />
                      ) : (
                        <ImageIcon className="w-8 h-8 text-on-surface-variant/30" />
                      )}
                      <label className="absolute inset-0 flex items-center justify-center bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                        <input type="file" className="hidden" onChange={e => handleFileUpload(e, 'logo')} accept="image/*" />
                        <div className="flex flex-col items-center gap-2">
                          <Camera className="w-6 h-6 text-primary" />
                          <span className="text-[8px] font-black text-on-surface uppercase tracking-widest">ALTERAR LOGO</span>
                        </div>
                      </label>
                      {uploading === 'logo' && <div className="absolute inset-0 bg-background/60 flex items-center justify-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}
                    </div>
                  </div>

                  {/* Institutional Photo */}
                  <div className="space-y-3">
                    <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Foto Institucional</label>
                    <div className="relative group aspect-square rounded-3xl bg-surface-container-highest overflow-hidden border-2 border-dashed border-outline-variant/20 flex items-center justify-center">
                      {settings.institutionalPhoto ? (
                        <img src={settings.institutionalPhoto} alt="Institucional" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="w-8 h-8 text-on-surface-variant/30" />
                      )}
                      <label className="absolute inset-0 flex items-center justify-center bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                        <input type="file" className="hidden" onChange={e => handleFileUpload(e, 'institutionalPhoto')} accept="image/*" />
                        <div className="flex flex-col items-center gap-2">
                          <Camera className="w-6 h-6 text-primary" />
                          <span className="text-[8px] font-black text-on-surface uppercase tracking-widest">ALTERAR FOTO</span>
                        </div>
                      </label>
                      {uploading === 'institutionalPhoto' && <div className="absolute inset-0 bg-background/60 flex items-center justify-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}
                    </div>
                  </div>

                  {/* Top Banner */}
                  <div className="space-y-3">
                    <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Banner Superior</label>
                    <div className="relative group aspect-square rounded-3xl bg-surface-container-highest overflow-hidden border-2 border-dashed border-outline-variant/20 flex items-center justify-center">
                      {settings.topBanner ? (
                        <img src={settings.topBanner} alt="Banner" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="w-8 h-8 text-on-surface-variant/30" />
                      )}
                      <label className="absolute inset-0 flex items-center justify-center bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                        <input type="file" className="hidden" onChange={e => handleFileUpload(e, 'topBanner')} accept="image/*" />
                        <div className="flex flex-col items-center gap-2">
                          <Camera className="w-6 h-6 text-primary" />
                          <span className="text-[8px] font-black text-on-surface uppercase tracking-widest">ALTERAR BANNER</span>
                        </div>
                      </label>
                      {uploading === 'topBanner' && <div className="absolute inset-0 bg-background/60 flex items-center justify-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}
                    </div>
                  </div>
                </div>
              </div>

              {/* Rewards Section */}
              <div className="space-y-4 border-t border-outline-variant/10 pt-6">
                <button 
                  onClick={() => toggleSection('rewards')}
                  className="w-full flex justify-between items-center p-4 bg-surface-container-low rounded-2xl border border-outline-variant/10"
                >
                  <h3 className="font-headline font-bold text-sm text-on-surface uppercase italic">RECOMPENSAS PADRÃO</h3>
                  {openSections.includes('rewards') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>

                <AnimatePresence>
                  {openSections.includes('rewards') && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden px-2 space-y-6"
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

              {/* Announcements Section */}
              <div className="space-y-4 border-t border-outline-variant/10 pt-6">
                <button 
                  onClick={() => toggleSection('announcements')}
                  className="w-full flex justify-between items-center p-4 bg-surface-container-low rounded-2xl border border-outline-variant/10"
                >
                  <h3 className="font-headline font-bold text-sm text-on-surface uppercase italic">AVISOS DO BOX</h3>
                  {openSections.includes('announcements') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>

                <AnimatePresence>
                  {openSections.includes('announcements') && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden px-2 space-y-4"
                    >
                      <div className="space-y-4">
                        <button 
                          onClick={() => setSettings(s => ({...s, announcements: [...s.announcements, { id: Date.now().toString(), title: '', content: '', date: new Date().toISOString(), active: true }]}))}
                          className="w-full py-3 border-2 border-dashed border-outline-variant/20 rounded-2xl text-[10px] font-black text-on-surface-variant uppercase tracking-widest hover:border-primary/30 hover:text-primary transition-all flex items-center justify-center gap-2"
                        >
                          <Plus className="w-4 h-4" /> ADICIONAR NOVO AVISO
                        </button>
                        
                        {settings.announcements.map((ann, idx) => (
                          <div key={ann.id} className="p-4 bg-surface-container-highest/30 rounded-2xl border border-outline-variant/10 space-y-4">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] text-primary font-black uppercase tracking-widest">AVISO #{idx + 1}</span>
                              <button 
                                onClick={() => setSettings(s => ({...s, announcements: s.announcements.filter(a => a.id !== ann.id)}))}
                                className="text-error hover:scale-110 transition-transform"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="space-y-3">
                              <input 
                                type="text" 
                                placeholder="TÍTULO DO AVISO"
                                value={ann.title}
                                onChange={e => {
                                  const newAnn = [...settings.announcements];
                                  newAnn[idx].title = e.target.value;
                                  setSettings({...settings, announcements: newAnn});
                                }}
                                className="w-full bg-surface-container-highest border-none rounded-xl p-3 font-headline font-bold text-on-surface text-sm"
                              />
                              <textarea 
                                placeholder="CONTEÚDO DO AVISO"
                                value={ann.content}
                                onChange={e => {
                                  const newAnn = [...settings.announcements];
                                  newAnn[idx].content = e.target.value;
                                  setSettings({...settings, announcements: newAnn});
                                }}
                                rows={2}
                                className="w-full bg-surface-container-highest border-none rounded-xl p-3 font-headline font-bold text-on-surface text-xs resize-none"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Toggle Sistema de Times */}
              <div className="flex items-center justify-between p-4 bg-surface-container-highest rounded-2xl">
                <div>
                  <p className="text-xs font-black text-on-surface uppercase italic">Sistema de Times</p>
                  <p className="text-[10px] text-on-surface-variant mt-0.5">Ativa disputa por territórios entre times</p>
                </div>
                <button
                  onClick={() => setSettings({...settings, clans_enabled: !(settings as any).clans_enabled} as any)}
                  className={`w-12 h-6 rounded-full transition-all relative ${(settings as any)?.clans_enabled ? 'bg-primary' : 'bg-surface-container-highest border border-outline-variant/30'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow transition-all absolute top-0.5 ${(settings as any)?.clans_enabled ? 'right-0.5' : 'left-0.5'}`} />
                </button>
              </div>

              {/* Toggle Sistema de Avatar */}
              <div className="flex items-center justify-between p-4 bg-surface-container-highest rounded-2xl">
                <div>
                  <p className="text-xs font-black text-on-surface uppercase italic">Sistema de Avatar</p>
                  <p className="text-[10px] text-on-surface-variant mt-0.5">Permite atletas customizar seu personagem na loja</p>
                </div>
                <button
                  onClick={() => setSettings({...settings, avatar_enabled: !(settings as any).avatar_enabled} as any)}
                  className={`w-12 h-6 rounded-full transition-all relative ${(settings as any)?.avatar_enabled ? 'bg-primary' : 'bg-surface-container-highest border border-outline-variant/30'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow transition-all absolute top-0.5 ${(settings as any)?.avatar_enabled ? 'right-0.5' : 'left-0.5'}`} />
                </button>
              </div>

              {/* Toggle Módulo Economia */}
              <div className="flex items-center justify-between p-4 bg-surface-container-highest rounded-2xl">
                <div>
                  <p className="text-xs font-black text-on-surface uppercase italic">Módulo Economia</p>
                  <p className="text-[10px] text-on-surface-variant mt-0.5">Ativa/desativa sistema de moedas e XP</p>
                </div>
                <button
                  onClick={() => setSettings({...settings, modules: {...settings.modules, economy: !settings.modules.economy}})}
                  className={`w-12 h-6 rounded-full transition-all relative ${settings.modules.economy ? 'bg-primary' : 'bg-surface-container-highest border border-outline-variant/30'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow transition-all absolute top-0.5 ${settings.modules.economy ? 'right-0.5' : 'left-0.5'}`} />
                </button>
              </div>

              {/* Toggle Módulo Loja */}
              <div className="flex items-center justify-between p-4 bg-surface-container-highest rounded-2xl">
                <div>
                  <p className="text-xs font-black text-on-surface uppercase italic">Módulo Loja</p>
                  <p className="text-[10px] text-on-surface-variant mt-0.5">Ativa/desativa loja de avatares para atletas</p>
                </div>
                <button
                  onClick={() => setSettings({...settings, modules: {...settings.modules, store: !settings.modules.store}})}
                  className={`w-12 h-6 rounded-full transition-all relative ${settings.modules.store ? 'bg-primary' : 'bg-surface-container-highest border border-outline-variant/30'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow transition-all absolute top-0.5 ${settings.modules.store ? 'right-0.5' : 'left-0.5'}`} />
                </button>
              </div>

              {/* Botão Salvar no final */}
              <button
                onClick={handleSaveSettings}
                className="w-full bg-primary text-background py-4 rounded-2xl font-headline font-black text-lg uppercase italic shadow-lg hover:scale-[0.98] active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Save className="w-5 h-5" /> SALVAR AJUSTES
              </button>
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

        {activeTab === 'challenges' && (
          <motion.div
            key="challenges"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="flex flex-col gap-6"
          >
            <div className="bg-surface-container-low p-6 rounded-[2rem] border border-outline-variant/10 space-y-4">
              <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic">CRIAR NOVO DESAFIO</h3>
              <div className="space-y-4">
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
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Descrição</label>
                  <textarea 
                    value={newChallenge.description} 
                    onChange={e => setNewChallenge({...newChallenge, description: e.target.value})}
                    rows={3}
                    className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface resize-none" 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">XP</label>
                    <input 
                      type="number" 
                      value={newChallenge.xp} 
                      onChange={e => setNewChallenge({...newChallenge, xp: parseInt(e.target.value)})}
                      className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Coins</label>
                    <input 
                      type="number" 
                      value={newChallenge.coins} 
                      onChange={e => setNewChallenge({...newChallenge, coins: parseInt(e.target.value)})}
                      className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" 
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Dias necessários para completar</label>
                  <input 
                    type="number" 
                    min={1}
                    value={newChallenge.required_days} 
                    onChange={e => setNewChallenge({...newChallenge, required_days: parseInt(e.target.value) || 1})}
                    className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" 
                  />
                  <p className="text-[9px] text-on-surface-variant opacity-60 uppercase tracking-widest">Aluno precisa marcar OK este número de dias para receber a recompensa</p>
                </div>
                <div className="flex items-center justify-between bg-surface-container-highest rounded-2xl px-4 py-3">
                  <div>
                    <p className="text-[10px] text-on-surface font-bold uppercase tracking-widest">Exigir foto como prova</p>
                    <p className="text-[9px] text-on-surface-variant opacity-60 uppercase tracking-widest">Aluno deve enviar foto ao marcar OK</p>
                  </div>
                  <button
                    onClick={() => setNewChallenge({...newChallenge, require_photo: !newChallenge.require_photo})}
                    className={cn(
                      "w-12 h-6 rounded-full transition-all relative",
                      newChallenge.require_photo ? "bg-primary" : "bg-surface-container-low border border-outline-variant/30"
                    )}
                  >
                    <span className={cn(
                      "absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all",
                      newChallenge.require_photo ? "left-6" : "left-0.5"
                    )} />
                  </button>
                </div>
                <button 
                  onClick={handleAddChallenge}
                  className="w-full bg-primary text-background py-4 rounded-2xl font-headline font-black uppercase italic shadow-lg flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" /> CRIAR DESAFIO
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic">DESAFIOS ATIVOS</h3>
              {challenges.map((c) => (
                <div key={c.id} className="bg-surface-container-low p-4 rounded-3xl border border-outline-variant/10 space-y-3 group relative">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="text-on-surface font-bold uppercase text-sm italic">{c.title}</h4>
                      <p className="text-on-surface-variant text-[10px] mt-1">{c.description}</p>
                    </div>
                    <div className="flex gap-2 ml-2">
                      <button
                        onClick={() => handleEditChallenge(c)}
                        className="p-2 bg-primary/20 text-primary rounded-xl opacity-0 group-hover:opacity-100 transition-all hover:bg-primary/30"
                        title="Editar desafio"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteChallenge(c.id)}
                        className="p-2 bg-error-container text-on-error-container rounded-xl opacity-0 group-hover:opacity-100 transition-all hover:bg-error/30"
                        title="Excluir desafio"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <span className={cn(
                      "text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest whitespace-nowrap ml-2",
                      c.active ? "bg-primary/20 text-primary" : "bg-surface-container-highest text-on-surface-variant"
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
                <ShoppingBag className="w-5 h-5 text-primary" /> {editingItem ? 'EDITAR ITEM' : 'ADICIONAR ITEM NA LOJA'}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">ID do Item</label>
                  <input 
                    type="text" 
                    value={editingItem ? editingItem.id : newItem.id} 
                    onChange={e => editingItem ? setEditingItem({...editingItem, id: e.target.value}) : setNewItem({...newItem, id: e.target.value})}
                    disabled={!!editingItem}
                    placeholder="ex: cap_red"
                    className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface disabled:opacity-50" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Nome</label>
                  <input 
                    type="text" 
                    value={editingItem ? editingItem.name : newItem.name} 
                    onChange={e => editingItem ? setEditingItem({...editingItem, name: e.target.value}) : setNewItem({...newItem, name: e.target.value})}
                    placeholder="ex: Boné Vermelho"
                    className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" 
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Slot</label>
                  <select 
                    value={editingItem ? editingItem.slot : newItem.slot} 
                    onChange={e => editingItem ? setEditingItem({...editingItem, slot: e.target.value as any}) : setNewItem({...newItem, slot: e.target.value as any})}
                    className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface appearance-none cursor-pointer" 
                  >
                    <option value="top">Cabeça</option>
                    <option value="body">Corpo</option>
                    <option value="legs">Pernas</option>
                    <option value="feet">Pés</option>
                    <option value="accessory">Acessório</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Preço (Coins)</label>
                  <input 
                    type="number" 
                    value={editingItem ? editingItem.price : newItem.price} 
                    onChange={e => editingItem ? setEditingItem({...editingItem, price: parseInt(e.target.value)}) : setNewItem({...newItem, price: parseInt(e.target.value)})}
                    className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">URL da Imagem</label>
                <input 
                  type="text" 
                  value={editingItem ? editingItem.image : newItem.image} 
                  onChange={e => editingItem ? setEditingItem({...editingItem, image: e.target.value}) : setNewItem({...newItem, image: e.target.value})}
                  placeholder="https://..."
                  className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" 
                />
              </div>
              <div className="flex gap-2">
                {editingItem ? (
                  <>
                    <button 
                      onClick={handleUpdateItem}
                      className="flex-1 bg-primary text-background py-4 rounded-2xl font-headline font-black uppercase italic shadow-lg flex items-center justify-center gap-2"
                    >
                      <Save className="w-5 h-5" /> SALVAR ALTERAÇÕES
                    </button>
                    <button 
                      onClick={() => setEditingItem(null)}
                      className="flex-1 bg-surface-container-highest text-on-surface py-4 rounded-2xl font-headline font-black uppercase italic shadow-lg flex items-center justify-center gap-2"
                    >
                      <X className="w-5 h-5" /> CANCELAR
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={handleAddItem}
                    className="w-full bg-primary text-background py-4 rounded-2xl font-headline font-black uppercase italic shadow-lg flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" /> ADICIONAR ITEM
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {items.map((item) => (
                <div key={item.id} className="bg-surface-container-low p-4 rounded-3xl border border-outline-variant/10 flex flex-col gap-3 group relative">
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all z-10">
                    <button 
                      onClick={() => {
                        setEditingItem(item);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="p-2 bg-primary/20 text-primary rounded-xl hover:bg-primary hover:text-background transition-all"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDeleteItem(item.id)}
                      className="p-2 bg-error-container text-on-error-container rounded-xl hover:bg-error hover:text-white transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="aspect-square rounded-2xl bg-surface-container-highest flex items-center justify-center overflow-hidden">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-full h-full object-contain p-2" />
                    ) : (
                      <ShoppingBag className="w-8 h-8 text-on-surface-variant/30" />
                    )}
                  </div>
                  <div>
                    <p className="text-on-surface font-bold uppercase text-sm italic truncate">{item.name}</p>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-[10px] font-black text-secondary uppercase tracking-widest">{item.price} COINS</span>
                      <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest opacity-50">{item.slot}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'operation' && (
          <motion.div
            key="operation"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="flex flex-col gap-6"
          >
            {/* WOD Management */}
            <div className="bg-surface-container-low p-6 rounded-[2rem] border border-outline-variant/10 space-y-6">
              <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" /> GERENCIAR WODS
              </h3>
              
              <div className="space-y-4">
                {wods.slice(0, 5).map((wod) => (
                  <div key={wod.id} className="p-4 bg-surface-container-highest/30 rounded-2xl border border-outline-variant/10 flex justify-between items-center">
                    <div>
                      <p className="text-on-surface font-bold uppercase text-sm italic">{wod.name}</p>
                      <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">{format(new Date(wod.date), 'dd/MM/yyyy')} • {wod.type}</p>
                    </div>
                    <button 
                      onClick={() => setEditingWod(wod)}
                      className="p-2 bg-primary/10 text-primary rounded-xl hover:bg-primary hover:text-background transition-all"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* System Reset */}
            <div className="bg-error-container/10 p-6 rounded-[2rem] border border-error/20 space-y-4">
              <h3 className="font-headline font-bold text-lg text-error uppercase italic flex items-center gap-2">
                <Shield className="w-5 h-5" /> ZONA DE PERIGO
              </h3>
              <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest leading-relaxed">
                O reset do sistema limpará todos os dados de check-ins, resultados e histórico, mantendo apenas os perfis dos usuários (com XP zerado).
              </p>
              <button 
                onClick={handleSystemReset}
                className="w-full bg-error text-on-error py-4 rounded-2xl font-headline font-black uppercase italic shadow-lg flex items-center justify-center gap-2 hover:bg-error/90 transition-colors"
              >
                <Trash2 className="w-5 h-5" /> RESETAR SISTEMA PARA NOVA TEMPORADA
              </button>
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
              <div className="flex justify-between items-center">
                <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-primary" /> RANKING DE FREQUÊNCIA
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Mês</label>
                  <select 
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                    className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface appearance-none cursor-pointer"
                  >
                    {['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'].map((month, idx) => (
                      <option key={idx} value={idx}>{month}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Ano</label>
                  <select 
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface appearance-none cursor-pointer"
                  >
                    {[2024, 2025, 2026].map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                {historicalFrequencyRanking.map((u, idx) => (
                  <div key={u.id} className="bg-surface-container-highest/30 p-4 rounded-2xl border border-outline-variant/10 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <span className={cn(
                        "w-6 text-center font-headline font-black italic",
                        idx < 3 ? "text-primary text-lg" : "text-on-surface-variant text-sm"
                      )}>
                        {idx + 1}º
                      </span>
                      <div>
                        <p className="text-on-surface font-bold uppercase text-xs">{u.name}</p>
                        <p className="text-on-surface-variant text-[8px] font-bold uppercase tracking-widest">{u.role === 'admin' ? 'ADMIN' : u.role === 'coach' ? 'COACH' : 'ALUNO'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-primary font-headline font-black text-lg italic">{u.periodCount}</p>
                      <p className="text-on-surface-variant text-[8px] font-black uppercase tracking-widest">CHECK-INS</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
        {activeTab === 'checkins' && (() => {
          // Compute check-ins for the selected date grouped by schedule slot
          const dateStr = checkinsDate;
          const dayOfWeek = new Date(dateStr + 'T12:00:00').getDay();

          // Slots active on this day
          const activeSlots = schedule.filter(s => s.isActive && s.days?.includes(dayOfWeek));

          // All checkins on this date
          const dayCheckins = users.flatMap(u =>
            u.checkins
              .filter(c => c.date === dateStr)
              .map(c => ({ ...c, user: u }))
          );

          // Summary
          const totalExpected = activeSlots.reduce((acc, s) => acc + s.capacity, 0);
          const totalPresent = dayCheckins.length;
          const totalAbsent = Math.max(0, totalExpected - totalPresent);

          return (
            <motion.div
              key="checkins"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="flex flex-col gap-6"
            >
              {/* Date picker + summary */}
              <div className="bg-surface-container-low p-6 rounded-[2rem] border border-outline-variant/10 space-y-4">
                <div className="flex justify-between items-center flex-wrap gap-3">
                  <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic flex items-center gap-2">
                    <History className="w-5 h-5 text-primary" /> CHECK-INS DO DIA
                  </h3>
                  <input
                    type="date"
                    value={checkinsDate}
                    onChange={e => setCheckinsDate(e.target.value)}
                    className="bg-surface-container-highest border-none rounded-2xl px-4 py-3 font-headline font-bold text-on-surface text-sm"
                  />
                </div>

                {/* Metric cards */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-surface-container-highest rounded-2xl p-4 text-center">
                    <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest mb-1">Check-ins</p>
                    <p className="text-2xl font-headline font-black text-primary italic">{totalPresent}</p>
                  </div>
                  <div className="bg-surface-container-highest rounded-2xl p-4 text-center">
                    <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest mb-1">Esperados</p>
                    <p className="text-2xl font-headline font-black text-on-surface italic">{totalExpected}</p>
                  </div>
                  <div className="bg-surface-container-highest rounded-2xl p-4 text-center">
                    <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest mb-1">Ausências</p>
                    <p className="text-2xl font-headline font-black text-error italic">{totalAbsent}</p>
                  </div>
                </div>
              </div>

              {/* Slots */}
              {activeSlots.length === 0 ? (
                <div className="bg-surface-container-low p-8 rounded-3xl border border-outline-variant/10 text-center">
                  <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest opacity-50 italic">Nenhuma aula programada para este dia</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeSlots.map(slot => {
                    const slotCheckins = dayCheckins.filter(c =>
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
                    );
                    const pct = slot.capacity > 0 ? Math.round((slotCheckins.length / slot.capacity) * 100) : 0;
                    const isOpen = !!checkinsExpanded[slot.id || slot.time];

                    return (
                      <div key={slot.id || slot.time} className="bg-surface-container-low rounded-3xl border border-outline-variant/10 overflow-hidden">
                        <button
                          onClick={() => setCheckinsExpanded(prev => ({ ...prev, [slot.id || slot.time]: !prev[slot.id || slot.time] }))}
                          className="w-full flex justify-between items-center p-4 hover:border-primary/20 transition-all"
                        >
                          <div className="flex items-center gap-4">
                            <div className="p-3 bg-primary/10 rounded-2xl">
                              <Clock className="w-5 h-5 text-primary" />
                            </div>
                            <div className="text-left">
                              <p className="text-on-surface font-bold uppercase text-sm italic">{slot.time} – {slot.endTime}</p>
                              <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">Coach: {slot.coach}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {/* Progress bar */}
                            <div className="hidden sm:flex items-center gap-2">
                              <div className="w-20 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${Math.min(pct, 100)}%`,
                                    background: pct >= 80 ? '#639922' : pct >= 50 ? '#BA7517' : '#E24B4A'
                                  }}
                                />
                              </div>
                              <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest min-w-[52px] text-right">
                                {slotCheckins.length}/{slot.capacity}
                              </span>
                            </div>
                            <span className={cn(
                              "text-[8px] font-black px-2 py-1 rounded-full uppercase tracking-widest",
                              pct >= 80 ? "bg-primary/20 text-primary" : pct >= 50 ? "bg-secondary/20 text-secondary" : "bg-error-container text-on-error-container"
                            )}>
                              {pct}%
                            </span>
                            <ChevronDown className={cn("w-4 h-4 text-on-surface-variant transition-transform", isOpen && "rotate-180")} />
                          </div>
                        </button>

                        <AnimatePresence>
                          {isOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden border-t border-outline-variant/10"
                            >
                              <div className="p-4 space-y-2">
                                {slotCheckins.length === 0 ? (
                                  <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest opacity-50 italic text-center py-4">
                                    Nenhum check-in registrado nesta aula
                                  </p>
                                ) : (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {slotCheckins.map((c, idx) => (
                                      <div key={idx} className="flex items-center gap-3 bg-surface-container-highest/40 px-3 py-2.5 rounded-2xl">
                                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-headline font-black text-sm flex-shrink-0">
                                          {(c.user.name || 'S')[0]}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-on-surface font-bold uppercase text-xs truncate">{c.user.name}</p>
                                          {c.timestamp && (
                                            <p className="text-on-surface-variant text-[8px] font-bold uppercase tracking-widest">
                                              {format(new Date(c.timestamp), 'HH:mm')}
                                            </p>
                                          )}
                                        </div>
                                        <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Checkins without a matched slot */}
              {(() => {
                const matchedUserIds = new Set(
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
                const unmatched = dayCheckins.filter(c => !matchedUserIds.has(c.user.id + (c.timestamp || '')));
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
                          <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center text-secondary font-headline font-black text-sm flex-shrink-0">
                            {(c.user.name || 'S')[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-on-surface font-bold uppercase text-xs truncate">{c.user.name}</p>
                            {c.timestamp && (
                              <p className="text-on-surface-variant text-[8px] font-bold uppercase tracking-widest">
                                {format(new Date(c.timestamp), 'HH:mm')}
                              </p>
                            )}
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

      {/* Edit WOD Modal */}
      <AnimatePresence>
        {editingWod && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-lg bg-surface-container-low rounded-[2.5rem] border border-outline-variant/10 p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center">
                <h3 className="font-headline font-bold text-xl text-on-surface uppercase italic">EDITAR WOD</h3>
                <button onClick={() => setEditingWod(null)} className="p-2 text-on-surface-variant hover:text-on-surface transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Nome do WOD</label>
                  <input 
                    type="text" 
                    value={editingWod.name} 
                    onChange={e => setEditingWod({...editingWod, name: e.target.value})}
                    className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Tipo</label>
                    <input 
                      type="text" 
                      value={editingWod.type} 
                      onChange={e => setEditingWod({...editingWod, type: e.target.value})}
                      className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Data</label>
                    <input 
                      type="date" 
                      value={editingWod.date} 
                      onChange={e => setEditingWod({...editingWod, date: e.target.value})}
                      className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" 
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">RX</label>
                  <textarea 
                    value={editingWod.rx} 
                    onChange={e => setEditingWod({...editingWod, rx: e.target.value})}
                    rows={3}
                    className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface resize-none" 
                  />
                </div>
                <button 
                  onClick={handleUpdateWod}
                  className="w-full bg-primary text-background py-4 rounded-2xl font-headline font-black uppercase italic shadow-lg flex items-center justify-center gap-2"
                >
                  <Save className="w-5 h-5" /> SALVAR WOD
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Challenge Modal */}
      <AnimatePresence>
        {isEditingChallenge && editingChallenge && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-lg bg-surface-container-low rounded-[2.5rem] border border-outline-variant/10 p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center">
                <h3 className="font-headline font-bold text-xl text-on-surface uppercase italic">EDITAR DESAFIO</h3>
                <button onClick={() => { setEditingChallenge(null); setIsEditingChallenge(false); }} className="p-2 text-on-surface-variant hover:text-on-surface transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Título</label>
                  <input 
                    type="text" 
                    value={editingChallenge.title} 
                    onChange={e => setEditingChallenge({...editingChallenge, title: e.target.value})}
                    className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Descrição</label>
                  <textarea 
                    value={editingChallenge.description} 
                    onChange={e => setEditingChallenge({...editingChallenge, description: e.target.value})}
                    rows={3}
                    className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface resize-none" 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Data Inicial</label>
                    <input 
                      type="date" 
                      value={editingChallenge.startDate} 
                      onChange={e => setEditingChallenge({...editingChallenge, startDate: e.target.value})}
                      className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Data Final</label>
                    <input 
                      type="date" 
                      value={editingChallenge.endDate} 
                      onChange={e => setEditingChallenge({...editingChallenge, endDate: e.target.value})}
                      className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" 
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">XP</label>
                    <input 
                      type="number" 
                      value={editingChallenge.xp} 
                      onChange={e => setEditingChallenge({...editingChallenge, xp: parseInt(e.target.value)})}
                      className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Coins</label>
                    <input 
                      type="number" 
                      value={editingChallenge.coins} 
                      onChange={e => setEditingChallenge({...editingChallenge, coins: parseInt(e.target.value)})}
                      className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" 
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Dificuldade</label>
                    <select 
                      value={editingChallenge.difficulty} 
                      onChange={e => setEditingChallenge({...editingChallenge, difficulty: e.target.value})}
                      className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface appearance-none cursor-pointer" 
                    >
                      <option value="easy">Fácil</option>
                      <option value="medium">Médio</option>
                      <option value="hard">Difícil</option>
                      <option value="special">Especial</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Status</label>
                    <select 
                      value={editingChallenge.active ? 'true' : 'false'} 
                      onChange={e => setEditingChallenge({...editingChallenge, active: e.target.value === 'true'})}
                      className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface appearance-none cursor-pointer" 
                    >
                      <option value="true">Ativo</option>
                      <option value="false">Inativo</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Dias necessários para completar</label>
                <input 
                  type="number" 
                  min={1}
                  value={editingChallenge.required_days || 1} 
                  onChange={e => setEditingChallenge({...editingChallenge, required_days: parseInt(e.target.value) || 1})}
                  className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" 
                />
                <p className="text-[9px] text-on-surface-variant opacity-60 uppercase tracking-widest">Aluno precisa marcar OK este número de dias para receber a recompensa</p>
              </div>
              <div className="flex items-center justify-between bg-surface-container-highest rounded-2xl px-4 py-3">
                <div>
                  <p className="text-[10px] text-on-surface font-bold uppercase tracking-widest">Exigir foto como prova</p>
                  <p className="text-[9px] text-on-surface-variant opacity-60 uppercase tracking-widest">Aluno deve enviar foto ao marcar OK</p>
                </div>
                <button
                  onClick={() => setEditingChallenge({...editingChallenge, require_photo: !editingChallenge.require_photo})}
                  className={cn(
                    "w-12 h-6 rounded-full transition-all relative",
                    editingChallenge.require_photo ? "bg-primary" : "bg-surface-container-low border border-outline-variant/30"
                  )}
                >
                  <span className={cn(
                    "absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all",
                    editingChallenge.require_photo ? "left-6" : "left-0.5"
                  )} />
                </button>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => { setEditingChallenge(null); setIsEditingChallenge(false); }}
                  className="flex-1 bg-surface-container-highest text-on-surface py-3 rounded-2xl font-headline font-bold uppercase italic transition-colors hover:bg-surface-container-highest/80"
                >
                  CANCELAR
                </button>
                <button 
                  onClick={handleUpdateChallenge}
                  className="flex-1 bg-primary text-background py-3 rounded-2xl font-headline font-bold uppercase italic flex items-center justify-center gap-2 transition-colors hover:bg-primary/90"
                >
                  <Save className="w-5 h-5" /> SALVAR
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
