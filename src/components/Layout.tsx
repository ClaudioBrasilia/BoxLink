import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Home, Trophy, User, Swords, Zap, Box, LayoutDashboard, LogOut, Menu, X, Sparkles, LineChart, Activity, Users, Timer } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';
import InstallPrompt from './InstallPrompt';
import { useNotifications } from '../hooks/useNotifications';
import { supabase } from '../lib/supabase';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [offline, setOffline]       = useState(!navigator.onLine);

  // Badge duelos: duelos pendentes onde o usuário é oponente e ainda não aceitou
  const [pendingDuels, setPendingDuels] = useState(0);
  // Badge feed: notificações não lidas do tipo like/comment
  const { notifications } = useNotifications();
  const feedUnread = notifications.filter(n =>
    !n.read && (n.type === 'like' || n.type === 'comment')
  ).length;

  // Offline detector
  useEffect(() => {
    const on  = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online',  on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // Duelos pendentes — polling leve a cada 30s
  useEffect(() => {
    if (!user?.id) return;
    const fetchPending = async () => {
      const { data } = await supabase
        .from('duels')
        .select('id, accepted_by, opponent_ids')
        .eq('status', 'pending')
        .contains('opponent_ids', [user.id]);
      const pending = (data || []).filter(
        (d: any) => !(d.accepted_by || []).includes(user.id)
      ).length;
      setPendingDuels(pending);
    };
    fetchPending();
    const interval = setInterval(fetchPending, 30000);

    // Realtime para atualização imediata
    const channel = supabase
      .channel('duels-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'duels' }, fetchPending)
      .subscribe();

    return () => { clearInterval(interval); supabase.removeChannel(channel); };
  }, [user?.id]);

  const navItems = [
    { icon: Home,   label: 'Início',  path: '/',            badge: 0          },
    { icon: Swords, label: 'Duelos',  path: '/duels',       badge: pendingDuels },
    { icon: Users,  label: 'Feed',    path: '/feed',        badge: feedUnread  },
    { icon: Trophy, label: 'Ranking', path: '/leaderboard', badge: 0          },
    { icon: User,   label: 'Perfil',  path: '/profile',     badge: 0          },
  ];

  const moreItems = [
    { icon: Timer,         label: 'WOD',      path: '/wod'        },
    { icon: Zap,           label: 'Desafios', path: '/challenges' },
    { icon: LineChart,     label: 'Evolução', path: '/progress'   },
    { icon: Box,           label: 'Meu Box',  path: '/mybox'      },
    { icon: Users,         label: 'Clãs',     path: '/clans'      },
    { icon: Sparkles,      label: 'Avatar',   path: '/avatar'     },
    ...(user?.role === 'admin'
      ? [{ icon: LayoutDashboard, label: 'Admin', path: '/admin' }] : []),
    ...(user?.role === 'coach' || user?.role === 'admin'
      ? [{ icon: LayoutDashboard, label: 'Coach', path: '/coach' }] : []),
  ];

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="min-h-screen bg-background text-on-surface font-body selection:bg-primary selection:text-background">

      {/* Offline banner */}
      <AnimatePresence>
        {offline && (
          <motion.div
            initial={{ y: -40 }} animate={{ y: 0 }} exit={{ y: -40 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed top-0 left-0 right-0 z-[300] bg-error text-on-error flex items-center justify-center gap-2 py-2 text-[11px] font-black uppercase tracking-widest"
          >
            <WifiOff className="w-3.5 h-3.5" /> Sem conexão — verifique sua internet
          </motion.div>
        )}
      </AnimatePresence>

      {/* HR Bar */}
      <div className="bg-surface-container-highest/50 border-b border-outline-variant/10 px-4 py-1.5 flex items-center justify-between overflow-hidden z-50 sticky top-0 backdrop-blur-md">
        <div className="flex items-center gap-4 animate-marquee-slow whitespace-nowrap">
          <div className="flex items-center gap-2">
            <Activity className="w-3 h-3 text-primary animate-pulse" />
            <span className="text-[8px] font-black uppercase tracking-widest italic">Live HR:</span>
          </div>
          {[72, 85, 110, 92, 125, 88, 140, 95, 102, 118].map((bpm, i) => (
            <div key={i} className="flex items-center gap-1.5 bg-surface-container-low px-2 py-0.5 rounded-full border border-outline-variant/10">
              <span className="text-[8px] font-bold text-on-surface-variant">ATLETA {i+1}</span>
              <span className={cn("text-[8px] font-black italic", bpm > 110 ? "text-secondary" : "text-primary")}>{bpm} BPM</span>
            </div>
          ))}
          {[72, 85, 110, 92, 125, 88, 140, 95, 102, 118].map((bpm, i) => (
            <div key={`d-${i}`} className="flex items-center gap-1.5 bg-surface-container-low px-2 py-0.5 rounded-full border border-outline-variant/10">
              <span className="text-[8px] font-bold text-on-surface-variant">ATLETA {i+1}</span>
              <span className={cn("text-[8px] font-black italic", bpm > 110 ? "text-secondary" : "text-primary")}>{bpm} BPM</span>
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
                  {/* Icon + badge */}
                  <div className="relative">
                    <item.icon className={cn('w-6 h-6 transition-transform', isActive && 'scale-110')} />
                    {item.badge > 0 && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1.5 -right-1.5 bg-primary text-background text-[8px] font-black min-w-[14px] h-[14px] px-0.5 rounded-full flex items-center justify-center shadow-[0_0_6px_rgba(202,253,0,0.5)]"
                      >
                        {item.badge > 9 ? '9+' : item.badge}
                      </motion.span>
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

      <InstallPrompt />
    </div>
  );
}
