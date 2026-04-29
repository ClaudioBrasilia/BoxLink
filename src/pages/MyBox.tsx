import { useState, useEffect } from 'react';
import { Box, MapPin, Users, Trophy, ChevronRight, Info, Phone, Instagram, Globe } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { BoxSettings, User } from '../types';

export default function MyBox() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<BoxSettings | null>(null);
  const [coaches, setCoaches] = useState<User[]>([]);
  const [topAthletes, setTopAthletes] = useState<User[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      // Fetch box settings
      const { data: settingsData } = await supabase.from('box_settings').select('*').single();
      if (settingsData) {
        setSettings({
          ...settingsData,
          location: { lat: settingsData.lat, lng: settingsData.lng }
        } as any);
      }

      // Fetch users (coaches and top athletes)
      const { data: usersData } = await supabase.from('profiles').select('*');
      if (usersData) {
        const allUsers = usersData.map((u: any) => ({
          ...u,
          avatar: { equipped: u.avatar_equipped, inventory: u.avatar_inventory },
          checkins: [],
          paidBonuses: u.paid_bonuses || []
        }));
        
        setCoaches(allUsers.filter((u: any) => u.role === 'coach' || u.role === 'admin'));
        
        // Sort by XP for Wall of Fame
        const sorted = [...allUsers].sort((a, b) => (b.xp || 0) - (a.xp || 0));
        setTopAthletes(sorted.slice(0, 3));
      }
    };

    fetchData();
  }, []);

  if (!settings) return <div className="min-h-screen bg-background flex items-center justify-center text-primary font-headline font-black text-2xl italic animate-pulse">CARREGANDO BOX...</div>;

  return (
    <div className="flex flex-col gap-6 p-4 pt-8 min-h-screen bg-background pb-24">
      <header className="flex justify-between items-center">
        <h1 className="text-3xl font-headline font-black text-on-surface tracking-tight uppercase italic flex items-center gap-3">
          <Box className="w-8 h-8 text-primary" />
          MEU BOX
        </h1>
      </header>

      {/* Box Info Card */}
      <section className="bg-surface-container-low rounded-[2.5rem] border border-outline-variant/10 p-8 relative overflow-hidden">
        <div className="flex flex-col items-center gap-6 text-center">
          <img 
            src={settings.logo} 
            alt="Logo" 
            className="w-24 h-24 rounded-3xl border-2 border-primary shadow-[0_0_20px_rgba(202,253,0,0.3)] object-cover" 
          />
          <div>
            <h2 className="text-4xl font-headline font-black text-on-surface italic uppercase tracking-tighter leading-none mb-2">{settings.name}</h2>
            <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest italic">Onde campeões são forjados</p>
          </div>
          
          <div className="flex gap-4">
            <button className="p-3 bg-surface-container-highest rounded-2xl text-on-surface hover:text-primary transition-all">
              <Instagram className="w-5 h-5" />
            </button>
            <button className="p-3 bg-surface-container-highest rounded-2xl text-on-surface hover:text-primary transition-all">
              <Phone className="w-5 h-5" />
            </button>
            <button className="p-3 bg-surface-container-highest rounded-2xl text-on-surface hover:text-primary transition-all">
              <Globe className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      {/* Location Section */}
      <section className="space-y-4">
        <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic flex items-center gap-2">
          <MapPin className="w-5 h-5 text-primary" /> LOCALIZAÇÃO
        </h3>
        <div className="bg-surface-container-low p-6 rounded-3xl border border-outline-variant/10 flex flex-col gap-4">
          <div className="aspect-video bg-surface-container-highest rounded-2xl border border-outline-variant/10 flex flex-col items-center justify-center gap-2 text-on-surface-variant">
            <MapPin className="w-8 h-8 opacity-20" />
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-50 italic">Mapa Interativo</span>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-50 italic">Lat: {settings.location.lat} | Lng: {settings.location.lng}</p>
          </div>
          <p className="text-sm text-on-surface font-medium leading-relaxed opacity-80 text-center">
            Av. Principal, 123 - Centro, Brasília - DF
          </p>
          <button
            className="w-full bg-primary text-background py-4 rounded-2xl font-headline font-black uppercase italic shadow-lg flex items-center justify-center gap-2"
            onClick={() => window.open(`https://www.google.com/maps?q=${settings.location.lat},${settings.location.lng}`, '_blank')}
          >
            ABRIR NO GOOGLE MAPS <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* Wall of Fame */}
      <section className="space-y-4">
        <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic flex items-center gap-2">
          <Trophy className="w-5 h-5 text-secondary" /> WALL OF FAME
        </h3>
        <div className="grid grid-cols-3 gap-4">
          {topAthletes.map((athlete, index) => (
            <div key={athlete.id} className="bg-surface-container-low p-4 rounded-3xl border border-outline-variant/10 flex flex-col items-center gap-2 relative">
              <div className={cn(
                "absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black italic",
                index === 0 ? "bg-primary text-background" : 
                index === 1 ? "bg-outline-variant/30 text-on-surface" : 
                "bg-secondary/30 text-secondary"
              )}>
                #{index + 1}
              </div>
              <div className="w-12 h-12 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface font-headline font-black text-xl">
                {athlete.name[0]}
              </div>
              <span className="text-[10px] font-headline font-black text-on-surface uppercase italic truncate w-full text-center">{athlete.name.split(' ')[0]}</span>
              <span className="text-[8px] text-on-surface-variant font-bold uppercase tracking-widest">{athlete.xp} XP</span>
            </div>
          ))}
        </div>
      </section>

      {/* Coaches Section */}
      <section className="space-y-4">
        <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" /> NOSSOS COACHES
        </h3>
        <div className="space-y-3">
          {coaches.map((coach) => (
            <div key={coach.id} className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/10 flex items-center justify-between group hover:border-primary/30 transition-all">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-headline font-black text-xl">
                  {coach.name[0]}
                </div>
                <div>
                  <p className="text-on-surface font-bold uppercase text-sm italic">{coach.name}</p>
                  <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">
                    {coach.role === 'admin' ? 'Head Coach' : 'Coach'}
                  </p>
                </div>
              </div>
              <div className="bg-primary/20 p-2 rounded-xl">
                <Info className="w-4 h-4 text-primary" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
