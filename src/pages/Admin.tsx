import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Users, MapPin, Calendar, Megaphone, Plus, Settings, 
  ChevronRight, ChevronDown, Activity, Check, X, Shield, UserPlus, 
  ImageIcon, ShoppingBag, Tv, Trophy, History, Search, Filter,
  Clock, ToggleLeft, ToggleRight, Trash2, Edit2, Save
} from 'lucide-react';
import { cn } from '../lib/utils';
import { User, BoxSettings, Schedule, Item, Duel, Wod } from '../types';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { supabase } from '../lib/supabase';

export default function Admin() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'settings' | 'schedule' | 'challenges' | 'store' | 'operation' | 'ranking'>('users');
  const [settings, setSettings] = useState<BoxSettings | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<Record<string, string>>({});
  const [schedule, setSchedule] = useState<Schedule[]>([]);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [duels, setDuels] = useState<Duel[]>([]);
  const [wods, setWods] = useState<Wod[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');

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

  const [openSections, setOpenSections] = useState<string[]>(['general', 'checkin', 'challenges', 'weekly', 'other', 'tv', 'system']);

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
    const { data: settingsData } = await supabase.from('box_settings').select('*').single();
    if (settingsData) {
      setSettings({
        ...settingsData,
        location: { lat: settingsData.lat, lng: settingsData.lng },
        rewards: settingsData.rewards || {},
        tv_config: settingsData.tv_config || {}
      } as any);
    }

    // Fetch Schedule
    const { data: scheduleData } = await supabase.from('schedule').select('*');
    if (scheduleData) setSchedule(scheduleData);

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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleStatusChange = async (userId: string, status: string) => {
    const role = selectedRoles[userId];
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
    const role = selectedRoles[userId];
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
        is_active: settings.isActive,
        rewards: settings.rewards,
        tv_config: settings.tv_config
      })
      .eq('id', settings.id)
      .select()
      .single();

    if (!error && data) {
      setSettings({
        ...data,
        location: { lat: data.lat, lng: data.lng }
      } as any);
      alert('Ajustes salvos com sucesso!');
    } else {
      alert('Erro ao salvar ajustes: ' + (error?.message || 'Erro desconhecido'));
    }
  };

  const handleAddSchedule = async () => {
    if (!newSchedule.time || !newSchedule.endTime || !newSchedule.coach) return;
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
      setSchedule([...schedule, data[0]]);
      setNewSchedule({ 
        time: '', 
        endTime: '', 
        coach: '', 
        capacity: 20,
        days: [1,2,3,4,5],
        isActive: true,
        checkinWindowMinutes: 60
      });
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
        difficulty: newChallenge.difficulty
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
        difficulty: 'easy'
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

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesStatus && matchesRole;
  });

  const pendingUsers = filteredUsers.filter(u => u.status === 'pending');
  const approvedUsers = filteredUsers.filter(u => u.status === 'approved');
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
        {(['users', 'settings', 'schedule', 'challenges', 'store', 'operation', 'ranking'] as const).map((tab) => (
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
                    <option value="student">ALUNOS</option>
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
                            {(['student', 'coach', 'admin'] as const).map((role) => (
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
            <div className="flex justify-between items-center mt-6 mb-2">
              <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic">GERENCIAR USUÁRIOS</h3>
              <span className="bg-surface-container-highest text-on-surface-variant text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">{approvedUsers.length} ATIVOS</span>
            </div>

            <div className="space-y-3">
              {approvedUsers.map((u) => (
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
                            {(['student', 'coach', 'admin'] as const).map((role) => (
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
              ))}
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
                      <div className="w-12 h-12 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface font-headline font-black text-xl">
                        {u.name[0]}
                      </div>
                      <div>
                        <p className="text-on-surface font-bold uppercase text-sm">{u.name}</p>
                        <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">{u.email}</p>
                      </div>
                    </div>
                    <button onClick={() => handleStatusChange(u.id, 'pending')} className="p-2 bg-primary/10 text-primary rounded-xl hover:bg-primary hover:text-background transition-all">
                      <UserPlus className="w-5 h-5" />
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
            <div className="bg-surface-container-low p-6 rounded-[2rem] border border-outline-variant/10 space-y-6">
              {/* General Section */}
              <div className="space-y-4">
                <button 
                  onClick={() => toggleSection('general')}
                  className="w-full flex justify-between items-center p-4 bg-surface-container-low rounded-2xl border border-outline-variant/10"
                >
                  <h3 className="font-headline font-bold text-sm text-on-surface uppercase italic flex items-center gap-2">
                    <LayoutDashboard className="w-4 h-4 text-primary" /> GERAL
                  </h3>
                  {openSections.includes('general') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                
                <AnimatePresence>
                  {openSections.includes('general') && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden px-2 space-y-4"
                    >
                      <div className="space-y-2">
                        <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Nome do Box</label>
                        <input 
                          type="text" 
                          value={settings?.name || ''} 
                          onChange={e => setSettings(s => s ? {...s, name: e.target.value} : null)}
                          className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">URL da Logo</label>
                        <div className="flex gap-4 items-center">
                          <input 
                            type="text" 
                            value={settings?.logo || ''} 
                            onChange={e => setSettings(s => s ? {...s, logo: e.target.value} : null)}
                            className="flex-1 bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" 
                          />
                          {settings?.logo && (
                            <img src={settings.logo} alt="Preview" className="w-12 h-12 rounded-xl object-cover border border-outline-variant/20" />
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Descrição do Box</label>
                        <textarea 
                          rows={3}
                          value={settings?.description || ''} 
                          onChange={e => setSettings(s => s ? {...s, description: e.target.value} : null)}
                          className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface resize-none" 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Foto Institucional (URL)</label>
                        <div className="flex gap-4 items-center">
                          <input 
                            type="text" 
                            value={settings?.institutionalPhoto || ''} 
                            onChange={e => setSettings(s => s ? {...s, institutionalPhoto: e.target.value} : null)}
                            className="flex-1 bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" 
                          />
                          {settings?.institutionalPhoto && (
                            <img src={settings.institutionalPhoto} alt="Preview" className="w-12 h-12 rounded-xl object-cover border border-outline-variant/20" />
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Banner Superior (URL)</label>
                        <div className="flex gap-4 items-center">
                          <input 
                            type="text" 
                            value={settings?.topBanner || ''} 
                            onChange={e => setSettings(s => s ? {...s, topBanner: e.target.value} : null)}
                            className="flex-1 bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" 
                          />
                          {settings?.topBanner && (
                            <img src={settings.topBanner} alt="Preview" className="w-12 h-12 rounded-xl object-cover border border-outline-variant/20" />
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Localização (Lat, Lng)</label>
                        <div className="flex gap-4">
                          <input 
                            type="text" 
                            value={settings?.location.lat || ''} 
                            onChange={e => setSettings(s => s ? {...s, location: {...s.location, lat: parseFloat(e.target.value)}} : null)}
                            className="flex-1 bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" 
                          />
                          <input 
                            type="text" 
                            value={settings?.location.lng || ''} 
                            onChange={e => setSettings(s => s ? {...s, location: {...s.location, lng: parseFloat(e.target.value)}} : null)}
                            className="flex-1 bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" 
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Raio de Check-in (metros)</label>
                        <input 
                          type="number" 
                          value={settings?.radius || 0} 
                          onChange={e => setSettings(s => s ? {...s, radius: parseInt(e.target.value)} : null)}
                          className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" 
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Check-in Section */}
              <div className="space-y-4 border-t border-outline-variant/10 pt-6">
                <button 
                  onClick={() => toggleSection('checkin')}
                  className="w-full flex justify-between items-center p-4 bg-surface-container-low rounded-2xl border border-outline-variant/10"
                >
                  <h3 className="font-headline font-bold text-sm text-on-surface uppercase italic">RECOMPENSAS POR CHECK-IN</h3>
                  {openSections.includes('checkin') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>

                <AnimatePresence>
                  {openSections.includes('checkin') && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden px-2 space-y-4"
                    >
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Sistema Ativo</label>
                        <button 
                          onClick={() => setSettings(s => s ? {...s, isActive: !s.isActive} : null)}
                          className={cn(
                            "w-10 h-6 rounded-full transition-all relative",
                            settings?.isActive ? "bg-primary" : "bg-surface-container-highest"
                          )}
                        >
                          <div className={cn(
                            "absolute top-1 w-4 h-4 rounded-full bg-background transition-all",
                            settings?.isActive ? "right-1" : "left-1"
                          )} />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">XP por Check-in</label>
                          <input 
                            type="number" 
                            value={settings?.rewards?.xp_per_checkin || 0} 
                            onChange={e => setSettings(s => s ? {...s, rewards: {...s.rewards, xp_per_checkin: parseInt(e.target.value)}} : null)}
                            className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" 
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">BrazaCoins por Check-in</label>
                          <input 
                            type="number" 
                            value={settings?.rewards?.coins_per_checkin || 0} 
                            onChange={e => setSettings(s => s ? {...s, rewards: {...s.rewards, coins_per_checkin: parseInt(e.target.value)}} : null)}
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
                                value={(settings?.rewards as any)?.[`challenge_${diff}_xp`] || 0} 
                                onChange={e => setSettings(s => s ? {...s, rewards: {...s.rewards, [`challenge_${diff}_xp`]: parseInt(e.target.value)}} : null)}
                                className="w-full bg-surface-container-highest border-none rounded-xl p-3 font-headline font-bold text-on-surface text-sm" 
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[8px] text-on-surface-variant font-bold uppercase tracking-widest">BrazaCoins</label>
                              <input 
                                type="number" 
                                value={(settings?.rewards as any)?.[`challenge_${diff}_coins`] || 0} 
                                onChange={e => setSettings(s => s ? {...s, rewards: {...s.rewards, [`challenge_${diff}_coins`]: parseInt(e.target.value)}} : null)}
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
                              value={(settings?.rewards as any)?.[`weekly_bonus_${count}_xp`] || 0} 
                              onChange={e => setSettings(s => s ? {...s, rewards: {...s.rewards, [`weekly_bonus_${count}_xp`]: parseInt(e.target.value)}} : null)}
                              className="w-full bg-surface-container-highest border-none rounded-xl p-3 font-headline font-bold text-on-surface text-sm" 
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[8px] text-on-surface-variant font-bold uppercase tracking-widest">BrazaCoins Bônus</label>
                            <input 
                              type="number" 
                              value={(settings?.rewards as any)?.[`weekly_bonus_${count}_coins`] || 0} 
                              onChange={e => setSettings(s => s ? {...s, rewards: {...s.rewards, [`weekly_bonus_${count}_coins`]: parseInt(e.target.value)}} : null)}
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
                      <div className="space-y-2">
                        <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">BrazaCoins por Level Up</label>
                        <input 
                          type="number" 
                          value={settings?.rewards?.level_up_bonus_coins || 0} 
                          onChange={e => setSettings(s => s ? {...s, rewards: {...s.rewards, level_up_bonus_coins: parseInt(e.target.value)}} : null)}
                          className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" 
                        />
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
                  <h3 className="font-headline font-bold text-sm text-on-surface uppercase italic">COMUNICADOS / NOVIDADES</h3>
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
                      {settings?.announcements?.map((ann, idx) => (
                        <div key={idx} className="flex gap-2">
                          <input 
                            value={ann}
                            onChange={(e) => {
                              const newAnn = [...(settings.announcements || [])];
                              newAnn[idx] = e.target.value;
                              setSettings(s => s ? { ...s, announcements: newAnn } : null);
                            }}
                            placeholder="Digite o comunicado..."
                            className="flex-1 bg-surface-container-highest border-none rounded-xl px-4 py-3 text-on-surface text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                          />
                          <button 
                            onClick={() => {
                              const newAnn = settings.announcements?.filter((_, i) => i !== idx);
                              setSettings(s => s ? { ...s, announcements: newAnn } : null);
                            }}
                            className="p-3 bg-error-container text-on-error-container rounded-xl"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <button 
                        onClick={() => setSettings(s => s ? { ...s, announcements: [...(s.announcements || []), ''] } : null)}
                        className="w-full py-3 border-2 border-dashed border-outline-variant/20 rounded-xl text-on-surface-variant text-[10px] font-bold uppercase tracking-widest hover:border-primary/50 hover:text-primary transition-all"
                      >
                        + ADICIONAR COMUNICADO
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* TV Config Section */}
              <div className="space-y-4 border-t border-outline-variant/10 pt-6">
                <button 
                  onClick={() => toggleSection('tv')}
                  className="w-full flex justify-between items-center p-4 bg-surface-container-low rounded-2xl border border-outline-variant/10"
                >
                  <h3 className="font-headline font-bold text-sm text-on-surface uppercase italic flex items-center gap-2">
                    <Tv className="w-4 h-4 text-primary" /> CONFIGURAÇÃO TV
                  </h3>
                  {openSections.includes('tv') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>

                <AnimatePresence>
                  {openSections.includes('tv') && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden px-2 space-y-4"
                    >
                      <div className="space-y-2">
                        <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Layout da TV</label>
                        <div className="flex gap-4">
                          {(['new', 'old'] as const).map(layout => (
                            <button 
                              key={layout}
                              onClick={() => setSettings(s => s ? {...s, tvLayout: layout} : null)}
                              className={cn(
                                "flex-1 py-3 rounded-xl font-headline font-bold text-[10px] uppercase tracking-widest transition-all",
                                settings?.tvLayout === layout ? "bg-primary text-background shadow-lg" : "bg-surface-container-highest text-on-surface"
                              )}
                            >
                              {layout === 'new' ? 'MODERNO' : 'CLÁSSICO'}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Bloco Direito</label>
                        <select 
                          value={settings?.tvConfig?.rightBlock || 'ranking'}
                          onChange={e => setSettings(s => s ? {...s, tvConfig: {...(s.tvConfig || {}), rightBlock: e.target.value as any}} : null)}
                          className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface"
                        >
                          <option value="ranking">RANKING DO DIA</option>
                          <option value="checkins">CHECK-INS RECENTES</option>
                          <option value="announcements">COMUNICADOS</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Bloco Superior</label>
                        <select 
                          value={settings?.tvConfig?.topBlock || 'wod'}
                          onChange={e => setSettings(s => s ? {...s, tvConfig: {...(s.tvConfig || {}), topBlock: e.target.value as any}} : null)}
                          className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface"
                        >
                          <option value="wod">WOD DO DIA</option>
                          <option value="timer">CRONÔMETRO</option>
                          <option value="announcements">COMUNICADOS</option>
                        </select>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* System Section */}
              <div className="space-y-4 border-t border-outline-variant/10 pt-6">
                <button 
                  onClick={() => toggleSection('system')}
                  className="w-full flex justify-between items-center p-4 bg-surface-container-low rounded-2xl border border-outline-variant/10"
                >
                  <h3 className="font-headline font-bold text-sm text-on-surface uppercase italic flex items-center gap-2">
                    <Settings className="w-4 h-4 text-primary" /> SISTEMA
                  </h3>
                  {openSections.includes('system') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>

                <AnimatePresence>
                  {openSections.includes('system') && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden px-2 space-y-4"
                    >
                      <div className="space-y-2">
                        <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Fuso Horário</label>
                        <select 
                          value={settings?.timezone || 'America/Sao_Paulo'}
                          onChange={e => setSettings(s => s ? {...s, timezone: e.target.value} : null)}
                          className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface"
                        >
                          <option value="America/Sao_Paulo">Brasília (GMT-3)</option>
                          <option value="America/New_York">New York (GMT-5)</option>
                          <option value="UTC">UTC</option>
                        </select>
                      </div>
                      <div className="space-y-4">
                        <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Módulos Ativos</label>
                        <div className="grid grid-cols-2 gap-4">
                          {(['economy', 'store', 'duels', 'challenges'] as const).map(module => (
                            <button 
                              key={module}
                              onClick={() => setSettings(s => s ? {...s, modules: {...(s.modules || {}), [module]: !s.modules?.[module]}} : null)}
                              className={cn(
                                "flex items-center justify-between p-4 rounded-2xl border transition-all",
                                settings?.modules?.[module] 
                                  ? "bg-primary/10 border-primary text-primary" 
                                  : "bg-surface-container-highest border-outline-variant/10 text-on-surface-variant"
                              )}
                            >
                              <span className="text-[10px] font-black uppercase tracking-widest">{module === 'economy' ? 'ECONOMIA' : module === 'store' ? 'LOJA' : module === 'duels' ? 'DUELOS' : 'DESAFIOS'}</span>
                              {settings?.modules?.[module] ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button 
                onClick={handleSaveSettings}
                className="w-full bg-primary text-background py-4 rounded-2xl font-headline font-black uppercase italic shadow-lg"
              >
                SALVAR AJUSTES
              </button>
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
            {/* Add Challenge Form */}
            <div className="bg-surface-container-low p-6 rounded-[2rem] border border-outline-variant/10 space-y-4">
              <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic">CRIAR DESAFIO</h3>
              <div className="space-y-2">
                <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Título</label>
                <input 
                  type="text" 
                  value={newChallenge.title} 
                  onChange={e => setNewChallenge({...newChallenge, title: e.target.value})}
                  placeholder="ex: 100 Burpees"
                  className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Descrição</label>
                <textarea 
                  rows={3}
                  value={newChallenge.description} 
                  onChange={e => setNewChallenge({...newChallenge, description: e.target.value})}
                  placeholder="Descreva o desafio..."
                  className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface resize-none" 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Início</label>
                  <input 
                    type="date" 
                    value={newChallenge.startDate} 
                    onChange={e => setNewChallenge({...newChallenge, startDate: e.target.value})}
                    className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Fim</label>
                  <input 
                    type="date" 
                    value={newChallenge.endDate} 
                    onChange={e => setNewChallenge({...newChallenge, endDate: e.target.value})}
                    className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" 
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
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
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Dificuldade</label>
                  <select 
                    value={newChallenge.difficulty} 
                    onChange={e => setNewChallenge({...newChallenge, difficulty: e.target.value})}
                    className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface"
                  >
                    <option value="easy">Fácil</option>
                    <option value="medium">Médio</option>
                    <option value="hard">Difícil</option>
                    <option value="special">Especial</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={newChallenge.repeatable} 
                    onChange={e => setNewChallenge({...newChallenge, repeatable: e.target.checked})}
                    className="w-5 h-5 rounded border-outline-variant/30 text-primary focus:ring-primary bg-surface-container-highest"
                  />
                  <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Repetível</span>
                </label>
                {newChallenge.repeatable && (
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Limite Diário:</label>
                    <input 
                      type="number" 
                      value={newChallenge.dailyLimit} 
                      onChange={e => setNewChallenge({...newChallenge, dailyLimit: parseInt(e.target.value)})}
                      className="w-16 bg-surface-container-highest border-none rounded-xl p-2 font-headline font-bold text-on-surface text-center" 
                    />
                  </div>
                )}
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
                <div key={c.id} className="bg-surface-container-low p-4 rounded-3xl border border-outline-variant/10 flex flex-col gap-3 group hover:border-primary/30 transition-all">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-on-surface font-bold uppercase text-sm italic">{c.title}</h4>
                      <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">{c.description}</p>
                    </div>
                    <span className={cn(
                      "text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest",
                      c.difficulty === 'easy' ? "bg-green-500/20 text-green-500" :
                      c.difficulty === 'medium' ? "bg-yellow-500/20 text-yellow-500" :
                      c.difficulty === 'hard' ? "bg-orange-500/20 text-orange-500" :
                      "bg-primary/20 text-primary"
                    )}>
                      {c.difficulty}
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
                  <input 
                    type="text" 
                    value={newSchedule.coach} 
                    onChange={e => setNewSchedule({...newSchedule, coach: e.target.value})}
                    placeholder="Nome do Coach"
                    className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Capacidade</label>
                  <input 
                    type="number" 
                    value={newSchedule.capacity} 
                    onChange={e => setNewSchedule({...newSchedule, capacity: parseInt(e.target.value)})}
                    className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Janela de Check-in (minutos antes)</label>
                <input 
                  type="number" 
                  value={newSchedule.checkinWindowMinutes} 
                  onChange={e => setNewSchedule({...newSchedule, checkinWindowMinutes: parseInt(e.target.value)})}
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
                    className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface"
                  >
                    <option value="top">CABEÇA</option>
                    <option value="middle">CORPO</option>
                    <option value="bottom">PERNAS</option>
                    <option value="shoes">PÉS</option>
                    <option value="accessory">ACESSÓRIO</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Preço (BrazaCoins)</label>
                  <input 
                    type="number" 
                    value={newItem.price} 
                    onChange={e => setNewItem({...newItem, price: parseInt(e.target.value)})}
                    className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Imagem (URL)</label>
                <input 
                  type="text" 
                  value={newItem.image} 
                  onChange={e => setNewItem({...newItem, image: e.target.value})}
                  placeholder="https://..."
                  className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" 
                />
              </div>
              <button 
                onClick={handleAddItem}
                className="w-full bg-primary text-background py-4 rounded-2xl font-headline font-black uppercase italic shadow-lg flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" /> ADICIONAR ITEM
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {items.map(item => (
                <div key={item.id} className="bg-surface-container-low p-4 rounded-3xl border border-outline-variant/10 flex flex-col gap-3 group">
                  <div className="aspect-square bg-surface-container-highest rounded-2xl flex items-center justify-center overflow-hidden border border-outline-variant/5 text-2xl">
                    {item.image ? (
                      item.image.startsWith('http') ? (
                        <img 
                          src={item.image} 
                          alt={item.name} 
                          className="w-full h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        item.image
                      )
                    ) : (
                      <ShoppingBag className="w-8 h-8 text-on-surface-variant/20" />
                    )}
                  </div>
                  <div>
                    <p className="text-on-surface font-bold uppercase text-[10px] italic truncate">{item.name}</p>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-secondary font-black text-[10px]">{item.price} BC</span>
                      <button onClick={() => handleDeleteItem(item.id)} className="text-error hover:scale-110 transition-transform">
                        <Trash2 className="w-4 h-4" />
                      </button>
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
            {/* WOD History Section */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic flex items-center gap-2">
                  <History className="w-5 h-5 text-primary" /> HISTÓRICO DE WODS
                </h3>
              </div>
              <div className="space-y-3">
                {wods.length > 0 ? wods.map(wod => (
                  <div key={wod.id} className="bg-surface-container-low p-4 rounded-3xl border border-outline-variant/10 flex justify-between items-center">
                    <div>
                      <p className="text-on-surface font-bold uppercase text-sm italic">{wod.title}</p>
                      <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">{format(parseISO(wod.date), 'dd/MM/yyyy')}</p>
                    </div>
                    <button className="p-2 text-on-surface-variant hover:text-primary transition-colors">
                      <Edit2 className="w-5 h-5" />
                    </button>
                  </div>
                )) : (
                  <div className="bg-surface-container-low p-8 rounded-3xl border border-outline-variant/10 text-center">
                    <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest opacity-50 italic">Nenhum WOD encontrado</p>
                  </div>
                )}
              </div>
            </div>

            {/* Duels History Section */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-primary" /> DUELOS ATIVOS
                </h3>
              </div>
              <div className="space-y-3">
                {duels.length > 0 ? duels.map(duel => (
                  <div key={duel.id} className="bg-surface-container-low p-4 rounded-3xl border border-outline-variant/10">
                    <div className="flex justify-between items-center mb-2">
                      <span className={cn(
                        "text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest",
                        duel.status === 'pending' ? "bg-yellow-500/20 text-yellow-500" :
                        duel.status === 'accepted' ? "bg-primary/20 text-primary" :
                        duel.status === 'completed' ? "bg-green-500/20 text-green-500" :
                        "bg-error-container text-on-error-container"
                      )}>
                        {duel.status === 'pending' ? 'PENDENTE' : 
                         duel.status === 'accepted' ? 'EM ANDAMENTO' : 
                         duel.status === 'completed' ? 'FINALIZADO' : 'CANCELADO'}
                      </span>
                      <span className="text-[8px] text-on-surface-variant font-bold uppercase tracking-widest">{format(parseISO(duel.created_at), 'dd/MM HH:mm')}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 text-center">
                        <p className="text-on-surface font-bold text-xs uppercase truncate">{(duel as any).challenger_name}</p>
                      </div>
                      <div className="text-primary font-black italic text-sm">VS</div>
                      <div className="flex-1 text-center">
                        <p className="text-on-surface font-bold text-xs uppercase truncate">{(duel as any).opponent_name}</p>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="bg-surface-container-low p-8 rounded-3xl border border-outline-variant/10 text-center">
                    <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest opacity-50 italic">Nenhum duelo ativo</p>
                  </div>
                )}
              </div>
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
                <h4 className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">RANKING DE FREQUÊNCIA (MÊS)</h4>
                <div className="space-y-2">
                  {approvedUsers.slice(0, 5).map((u, idx) => (
                    <div key={u.id} className="flex items-center justify-between p-3 bg-surface-container-highest/20 rounded-xl border border-outline-variant/5">
                      <div className="flex items-center gap-3">
                        <span className="w-5 text-[10px] font-black text-primary italic">#{idx + 1}</span>
                        <p className="text-xs font-bold text-on-surface uppercase">{u.name}</p>
                      </div>
                      <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">{20 - idx} PRESENÇAS</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
