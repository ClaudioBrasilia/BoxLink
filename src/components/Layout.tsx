import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Home, Timer, Trophy, User, Swords, Zap, Box, LayoutDashboard, LogOut, Menu, X, Sparkles, LineChart, Activity, Users, BarChart3 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [storeEnabled, setStoreEnabled] = useState(true);
  const [economyEnabled, setEconomyEnabled] = useState(true);
  const [pendingDuels, setPendingDuels] = useState(0);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data: settingsData } = await supabase.from('box_settings').select('modules').single();
      if (settingsData?.modules) {
        setStoreEnabled(settingsData.modules.store ?? true);
        setEconomyEnabled(settingsData.modules.economy ?? true);
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const fetchPending = async () => {
      const { count } = await supabase
        .from('duels')
        .select('id', { count: 'exact', head: true })
        .eq('opponent_id', user.id)
        .eq('status', 'pending');
      setPendingDuels(count || 0);
    };
    fetchPending();
    const channel = supabase.channel('layout-duels-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'duels' }, fetchPending)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const navItems = [
    { icon: Home, label: 'Início', path: '/' },
    { icon: Timer, label: 'WOD', path: '/wod' },
    { icon: Swords, label: 'Duelos', path: '/duels' },
    { icon: Trophy, label: 'Ranking', path: '/leaderboard' },
    { icon: User, label: 'Perfil', path: '/profile' },
  ];

  const moreItems = [
    { icon: Zap, label: 'Desafios', path: '/challenges' },
    { icon: LineChart, label: 'Evolução', path: '/progress' },
    { icon: Box, label: 'Meu Box', path: '/mybox' },
    { icon: Users, label: 'Times', path: '/clans' },
    ...(user?.role === 'admin' || (storeEnabled && economyEnabled) ? [{ icon: Sparkles, label: 'Avatar', path: '/avatar' }] : []),
    { icon: BarChart3, label: 'Benchmarks', path: '/benchmarks' },
    ...(user?.role === 'admin' ? [{ icon: LayoutDashboard, label: 'Admin', path: '/admin' }] : []),
    ...(user?.role === 'coach' || user?.role === 'admin' ? [{ icon: LayoutDashboard, label: 'Coach', path: '/coach' }] : []),
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background text-on-surface font-body selection:bg-primary selection:text-background">
      {/* HR Bar - Parity with CrossCity */}
      <div className="bg-surface-container-highest/50 border-b border-outline-variant/10 px-4 py-1.5 flex items-center justify-between overflow-hidden z-50 sticky top-0 backdrop-blur-md">
        <div className="flex items-center gap-4 animate-marquee-slow whitespace-nowrap">
          <div className="flex items-center gap-2">
            <Activity className="w-3 h-3 text-primary animate-pulse" />
            <span className="text-[8px] font-black uppercase tracking-widest italic">Live HR:</span>
          </div>
          {[72, 85, 110, 92, 125, 88, 140, 95, 102, 118].map((bpm, i) => (
            <div key={i} className="flex items-center gap-1.5 bg-surface-container-low px-2 py-0.5 rounded-full border border-outline-variant/10">
              <span className="text-[8px] font-bold text-on-surface-variant">ATLETA {i+1}</span>
              <span className={cn(
                "text-[8px] font-black italic",
                bpm > 110 ? "text-secondary" : "text-primary"
              )}>{bpm} BPM</span>
            </div>
          ))}
          {/* Duplicate for seamless loop */}
          {[72, 85, 110, 92, 125, 88, 140, 95, 102, 118].map((bpm, i) => (
            <div key={`dup-${i}`} className="flex items-center gap-1.5 bg-surface-container-low px-2 py-0.5 rounded-full border border-outline-variant/10">
              <span className="text-[8px] font-bold text-on-surface-variant">ATLETA {i+1}</span>
              <span className={cn(
                "text-[8px] font-black italic",
                bpm > 110 ? "text-secondary" : "text-primary"
              )}>{bpm} BPM</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-md mx-auto min-h-screen relative pb-24">
        <Outlet />
      </main>

      {/* More Menu Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl p-8 flex flex-col gap-8"
          >
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-headline font-black text-primary italic">MENU</h2>
              <button onClick={() => setIsMenuOpen(false)} className="p-2 bg-surface-container-highest rounded-full">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {moreItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMenuOpen(false)}
                  className="bg-surface-container-low p-6 rounded-3xl border border-outline-variant/10 flex flex-col items-center gap-3 hover:border-primary/50 transition-all"
                >
                  <item.icon className="w-8 h-8 text-primary" />
                  <span className="font-headline font-bold text-xs uppercase tracking-widest">{item.label}</span>
                </NavLink>
              ))}
            </div>

            <button
              onClick={handleLogout}
              className="mt-auto w-full bg-error-container text-on-error-container py-4 rounded-2xl font-headline font-black flex items-center justify-center gap-2 uppercase italic"
            >
              SAIR <LogOut className="w-5 h-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 w-full bg-surface-container-low/80 backdrop-blur-xl border-t border-outline-variant/10 z-40 safe-bottom">
        <div className="max-w-md mx-auto flex justify-around items-center h-20 px-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-1 transition-all duration-300 relative group flex-1',
                  isActive ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <div className="relative">
                    <item.icon className={cn('w-6 h-6 transition-transform', isActive && 'scale-110')} />
                    {item.path === '/duels' && pendingDuels > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 bg-secondary text-background text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-lg animate-pulse">
                        {pendingDuels}
                      </span>
                    )}
                  </div>
                  <span className="text-[8px] font-bold uppercase tracking-widest">{item.label}</span>
                  {isActive && (
                    <div className="absolute -top-2 w-1 h-1 bg-primary rounded-full shadow-[0_0_10px_#cafd00]" />
                  )}
                </>
              )}
            </NavLink>
          ))}
          <button
            onClick={() => setIsMenuOpen(true)}
            className="flex flex-col items-center gap-1 text-on-surface-variant hover:text-on-surface transition-all flex-1"
          >
            <Menu className="w-6 h-6" />
            <span className="text-[8px] font-bold uppercase tracking-widest">Mais</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
