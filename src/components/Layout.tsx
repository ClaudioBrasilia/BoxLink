import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Home, Timer, Trophy, User, Swords, Zap, Box, LayoutDashboard, LogOut, Menu, X, Sparkles, LineChart, Activity, Users } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotifications } from '../hooks/useNotifications';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { notifications, markRead } = useNotifications();

  useEffect(() => {
    const unreadToMark = notifications.filter(n => !n.read);
    if (location.pathname === '/' || location.pathname === '/dashboard') {
      unreadToMark.filter(n => n.type === 'announcement').forEach(n => markRead(n.id));
    } else if (location.pathname === '/duels') {
      unreadToMark.filter(n => ['duel_created', 'duel_accepted', 'duel_finished', 'duel_result'].includes(n.type)).forEach(n => markRead(n.id));
    } else if (location.pathname === '/feed') {
      unreadToMark.filter(n => ['like', 'comment', 'feed_post'].includes(n.type)).forEach(n => markRead(n.id));
    } else if (location.pathname === '/challenges') {
      unreadToMark.filter(n => ['challenge_done', 'challenge_new'].includes(n.type)).forEach(n => markRead(n.id));
    }
  }, [location.pathname, notifications, markRead]);

  const duelBadge = notifications.filter(n => !n.read && ['duel_created', 'duel_accepted', 'duel_finished', 'duel_result'].includes(n.type)).length;
  const feedBadge = notifications.filter(n => !n.read && ['like', 'comment', 'feed_post'].includes(n.type)).length;
  const challengeBadge = notifications.filter(n => !n.read && ['challenge_done', 'challenge_new'].includes(n.type)).length;
  const homeBadge = notifications.filter(n => !n.read && ['announcement'].includes(n.type)).length;

  const navItems = [
    { icon: Home,   label: 'Início',   path: '/',            badge: homeBadge },
    { icon: Swords, label: 'Duelos',   path: '/duels',       badge: duelBadge },
    { icon: Users,  label: 'Feed',     path: '/feed',        badge: feedBadge },
    { icon: Trophy, label: 'Ranking',  path: '/leaderboard', badge: 0 },
    { icon: User,   label: 'Perfil',   path: '/profile',     badge: 0 },
  ];

  const moreItems = [
    { icon: Zap,         label: 'Desafios', path: '/challenges' },
    { icon: LineChart,   label: 'Evolução', path: '/progress' },
    { icon: Box,         label: 'Meu Box',  path: '/mybox' },
    { icon: Users,       label: 'Times',    path: '/clans' },
    { icon: Sparkles,    label: 'Avatar',   path: '/avatar' },
    ...(user?.role === 'admin' ? [{ icon: LayoutDashboard, label: 'Admin', path: '/admin' }] : []),
    ...(user?.role === 'coach' || user?.role === 'admin' ? [{ icon: LayoutDashboard, label: 'Coach', path: '/coach' }] : []),
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background text-on-surface font-body selection:bg-primary selection:text-background">

      {/* 🔧 FIX: pointer-events-none na barra animada para não bloquear toques abaixo */}
      <div className="bg-surface-container-highest/50 border-b border-outline-variant/10 px-4 py-1.5 flex items-center justify-between overflow-hidden z-10 sticky top-0 backdrop-blur-md pointer-events-none">
        <div className="flex items-center gap-4 animate-marquee-slow whitespace-nowrap flex-1 overflow-hidden mr-3">
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
            <div key={`dup-${i}`} className="flex items-center gap-1.5 bg-surface-container-low px-2 py-0.5 rounded-full border border-outline-variant/10">
              <span className="text-[8px] font-bold text-on-surface-variant">ATLETA {i+1}</span>
              <span className={cn("text-[8px] font-black italic", bpm > 110 ? "text-secondary" : "text-primary")}>{bpm} BPM</span>
            </div>
          ))}
        </div>
      </div>

      {/* 🔧 FIX: overflow-y-auto garante scroll correto no WebView do Capacitor */}
      <main className="max-w-md mx-auto min-h-screen relative pb-24 overflow-y-auto">
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
                    {item.badge > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] bg-error text-white text-[8px] font-black rounded-full flex items-center justify-center px-0.5 shadow-md animate-pulse">
                        {item.badge > 9 ? '9+' : item.badge}
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
            <div className="relative">
              <Menu className="w-6 h-6" />
              {challengeBadge > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] bg-error text-white text-[8px] font-black rounded-full flex items-center justify-center px-0.5 shadow-md animate-pulse">
                  {challengeBadge > 9 ? '9+' : challengeBadge}
                </span>
              )}
            </div>
            <span className="text-[8px] font-bold uppercase tracking-widest">Mais</span>
          </button>
        </div>
      </nav>
    </div>
  );
     }
