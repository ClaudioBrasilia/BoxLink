import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Users, Swords, Plus, Crown, LogIn, Zap, Trophy, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Clan {
  id: string;
  name: string;
  motto: string;
  color: string;
  created_by: string;
  is_active: boolean;
  created_at: string;
}

interface ClanMembership {
  id: string;
  clan_id: string;
  user_id: string;
  role: 'member' | 'captain';
  status: 'pending' | 'approved' | 'rejected';
}

interface Territory {
  id: string;
  name: string;
  icon: string;
  focus: string;
  rotation_order: number;
}

interface DominationEvent {
  clan_id: string;
  energy: number;
}

export default function Clans() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [clans, setClans] = useState<Clan[]>([]);
  const [memberships, setMemberships] = useState<ClanMembership[]>([]);
  const [dominationEvents, setDominationEvents] = useState<DominationEvent[]>([]);
  const [territory, setTerritory] = useState<Territory | null>(null);
  const [myClan, setMyClan] = useState<Clan | null>(null);
  const [myMembership, setMyMembership] = useState<ClanMembership | null>(null);
  const [clansEnabled, setClansEnabled] = useState(false);
  const [maxMembers, setMaxMembers] = useState(10);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newClanName, setNewClanName] = useState('');
  const [newClanMotto, setNewClanMotto] = useState('');
  const [newClanColor, setNewClanColor] = useState('#CAFD00');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);

  const colors = ['#CAFD00', '#FF4444', '#4444FF', '#FF8800', '#AA44FF', '#00CCFF', '#FF44AA'];

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      // Check if clans are enabled
      const { data: settings } = await supabase
        .from('box_settings')
        .select('modules, max_clan_members')
        .maybeSingle();
      setClansEnabled(settings?.modules?.clans || false);
      setMaxMembers(settings?.max_clan_members || 10);

      // Fetch clans
      const { data: clansData } = await supabase
        .from('clans')
        .select('*')
        .eq('is_active', true)
        .order('created_at');
      setClans(clansData || []);

      // Fetch memberships
      const { data: membershipsData } = await supabase
        .from('clan_memberships')
        .select('*')
        .eq('status', 'approved');
      setMemberships(membershipsData || []);

      // Fetch today's domination events
      const { data: eventsData } = await supabase
        .from('domination_events')
        .select('clan_id, energy')
        .gte('created_at', today + 'T00:00:00')
        .lte('created_at', today + 'T23:59:59');
      setDominationEvents(eventsData || []);

      // Get territory of the day (rotate by day of year)
      const { data: territoriesData } = await supabase
        .from('territories')
        .select('*')
        .order('rotation_order');
      if (territoriesData && territoriesData.length > 0) {
        const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
        setTerritory(territoriesData[dayOfYear % territoriesData.length]);
      }

      // Find my clan
      if (user) {
        const { data: myMembershipData } = await supabase
          .from('clan_memberships')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'approved')
          .maybeSingle();
        setMyMembership(myMembershipData);

        if (myMembershipData) {
          const myClanData = clansData?.find(c => c.id === myMembershipData.clan_id) || null;
          setMyClan(myClanData);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const leaderboard = useMemo(() => {
    return clans.map(clan => {
      const members = memberships.filter(m => m.clan_id === clan.id);
      const energy = dominationEvents
        .filter(e => e.clan_id === clan.id)
        .reduce((sum, e) => sum + e.energy, 0);
      return { clan, memberCount: members.length, energy };
    }).sort((a, b) => b.energy - a.energy);
  }, [clans, memberships, dominationEvents]);

  const maxEnergy = Math.max(...leaderboard.map(i => i.energy), 1);

  const handleCreateClan = async () => {
    if (!newClanName.trim() || !user) return;
    setCreating(true);
    try {
      const { data: clan, error } = await supabase
        .from('clans')
        .insert({ name: newClanName.trim(), motto: newClanMotto.trim(), color: newClanColor, created_by: user.id })
        .select()
        .single();
      if (error) { alert('Erro ao criar time: ' + error.message); return; }

      await supabase.from('clan_memberships').insert({
        clan_id: clan.id, user_id: user.id, role: 'captain', status: 'approved'
      });

      setShowCreateModal(false);
      setNewClanName('');
      setNewClanMotto('');
      fetchAll();
    } finally {
      setCreating(false);
    }
  };

  const handleJoinClan = async (clanId: string) => {
    if (!user) return;
    
    // Check if clan is full
    const clanMembers = memberships.filter(m => m.clan_id === clanId);
    if (clanMembers.length >= maxMembers) {
      alert(`Este time já atingiu o limite máximo de ${maxMembers} membros.`);
      return;
    }

    setJoining(clanId);
    try {
      const { error } = await supabase.from('clan_memberships').insert({
        clan_id: clanId, user_id: user.id, role: 'member', status: 'pending'
      });
      if (error) { alert('Erro ao solicitar entrada: ' + error.message); return; }
      alert('Solicitação enviada! Aguarde aprovação do capitão.');
      fetchAll();
    } finally {
      setJoining(null);
    }
  };

  const handleLeaveClan = async () => {
    if (!myMembership || !user) return;
    if (!confirm('Tem certeza que deseja sair do time?')) return;
    await supabase.from('clan_memberships').delete().eq('id', myMembership.id);
    setMyClan(null);
    setMyMembership(null);
    fetchAll();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-primary font-headline font-black text-2xl italic animate-pulse">
        CARREGANDO...
      </div>
    );
  }

  if (!clansEnabled) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6 text-center">
        <Swords className="w-16 h-16 text-outline-variant" />
        <h2 className="text-2xl font-headline font-black text-on-surface uppercase italic">Times Desativados</h2>
        <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest max-w-xs">
          O sistema de times ainda não foi ativado pelo administrador do box.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 pt-8 min-h-screen bg-background">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-headline font-black text-on-surface uppercase italic tracking-tighter">
            TIMES
          </h1>
          <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest mt-1">
            Forme sua equipe. Domine o box.
          </p>
        </div>
        {!myClan && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-primary text-background px-4 py-2 rounded-xl font-headline font-black text-xs uppercase italic flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Criar Time
          </button>
        )}
      </div>

      {/* Território do Dia */}
      {territory && (
        <div className="bg-surface-container-low rounded-[2rem] border border-outline-variant/10 p-5">
          <p className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest mb-2">Território do Dia</p>
          <div className="flex items-center gap-3">
            <span className="text-4xl">{territory.icon}</span>
            <div>
              <h3 className="font-headline font-black text-on-surface uppercase italic">{territory.name}</h3>
              <p className="text-on-surface-variant text-xs">{territory.focus}</p>
            </div>
          </div>
        </div>
      )}

      {/* Meu Time */}
      {myClan && (
        <div className="bg-surface-container-low rounded-[2rem] border-2 p-5" style={{ borderColor: myClan.color }}>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest mb-1">Meu Time</p>
              <h3 className="font-headline font-black text-on-surface text-xl uppercase italic flex items-center gap-2">
                {myMembership?.role === 'captain' && <Crown className="w-5 h-5" style={{ color: myClan.color }} />}
                {myClan.name}
              </h3>
              {myClan.motto && <p className="text-on-surface-variant text-xs mt-1 italic">"{myClan.motto}"</p>}
            </div>
            <button
              onClick={handleLeaveClan}
              className="text-error text-xs font-black uppercase hover:underline"
            >
              Sair
            </button>
          </div>
        </div>
      )}

      {/* Ranking de Times */}
      <div>
        <h2 className="text-xs font-black text-on-surface-variant uppercase tracking-widest mb-3 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-primary" /> Ranking de Hoje
        </h2>
        <div className="flex flex-col gap-3">
          {leaderboard.map((item, idx) => {
            const isMine = myClan?.id === item.clan.id;
            const myMembershipForClan = memberships.find(m => m.user_id === user?.id && m.clan_id === item.clan.id);
            const alreadyRequested = !!myMembershipForClan;

            return (
              <motion.div
                key={item.clan.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`bg-surface-container-low rounded-[1.5rem] border p-4 ${isMine ? 'border-2' : 'border-outline-variant/10'}`}
                style={isMine ? { borderColor: item.clan.color } : {}}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center text-xl" style={{ border: `2px solid ${item.clan.color}` }}>
                      <Users className="w-5 h-5" style={{ color: item.clan.color }} />
                    </div>
                    <div>
                      <h4 className="font-headline font-black text-on-surface uppercase italic flex items-center gap-2">
                        {item.clan.name}
                        {isMine && <span className="bg-primary text-background text-[8px] px-1.5 py-0.5 rounded-full not-italic">MEU TIME</span>}
                      </h4>
                      <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">{item.memberCount} Membros</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-headline font-black text-on-surface italic">{item.energy} ENERGIA</p>
                    <div className="flex items-center gap-1 justify-end">
                      <Zap className="w-3 h-3 text-primary" />
                      <span className="text-[8px] text-on-surface-variant font-bold uppercase tracking-widest">Dominação</span>
                    </div>
                  </div>
                </div>

                {/* Energy Bar */}
                <div className="mt-3 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(item.energy / maxEnergy) * 100}%` }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: item.clan.color }}
                  />
                </div>

                {!myClan && !alreadyRequested && (
                  <button
                    onClick={() => handleJoinClan(item.clan.id)}
                    disabled={joining === item.clan.id}
                    className="mt-4 w-full py-2 bg-surface-container-highest rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-background transition-all flex items-center justify-center gap-2"
                  >
                    {joining === item.clan.id ? 'Solicitando...' : <><LogIn className="w-3 h-3" /> Solicitar Entrada</>}
                  </button>
                )}

                {alreadyRequested && !isMine && (
                  <div className="mt-4 w-full py-2 bg-surface-container-highest/50 rounded-xl text-[10px] font-black uppercase tracking-widest text-center text-on-surface-variant italic">
                    Solicitação Pendente
                  </div>
                )}
              </motion.div>
            );
          })}

          {leaderboard.length === 0 && (
            <div className="bg-surface-container-low rounded-[1.5rem] border border-outline-variant/10 p-8 text-center text-on-surface-variant">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="font-black uppercase italic text-sm">Nenhum time criado ainda</p>
              <p className="text-xs mt-1">Seja o primeiro a criar um time!</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Criar Time */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateModal(false)}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-surface-container-low rounded-[2.5rem] border border-outline-variant/20 p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="font-headline font-black text-on-surface text-xl uppercase italic">Criar Time</h2>
                <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-surface-container-highest rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest">Nome do Time</label>
                  <input
                    type="text"
                    value={newClanName}
                    onChange={(e) => setNewClanName(e.target.value)}
                    placeholder="Ex: OS BRUTOS"
                    className="w-full bg-surface-container-highest border-none rounded-2xl px-4 py-3 mt-1 text-on-surface placeholder:text-on-surface-variant/30 focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest">Lema (Opcional)</label>
                  <input
                    type="text"
                    value={newClanMotto}
                    onChange={(e) => setNewClanMotto(e.target.value)}
                    placeholder="Ex: Treine até a falha"
                    className="w-full bg-surface-container-highest border-none rounded-2xl px-4 py-3 mt-1 text-on-surface placeholder:text-on-surface-variant/30 focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest">Cor do Time</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {colors.map(color => (
                      <button
                        key={color}
                        onClick={() => setNewClanColor(color)}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${newClanColor === color ? 'border-on-surface scale-110' : 'border-transparent opacity-50'}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleCreateClan}
                  disabled={creating || !newClanName.trim()}
                  className="w-full bg-primary text-background py-4 rounded-2xl font-headline font-black uppercase italic tracking-tighter mt-4 disabled:opacity-50"
                >
                  {creating ? 'Criando...' : 'Criar Time'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
