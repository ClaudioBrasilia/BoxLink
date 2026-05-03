import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Wod from './pages/Wod';
import Challenges from './pages/Challenges';
import Leaderboard from './pages/Leaderboard';
import Duels from './pages/Duels';
import MyBox from './pages/MyBox';
import Profile from './pages/Profile';
import Progress from './pages/Progress';
import AvatarCustomization from './pages/AvatarCustomization';
import Admin from './pages/Admin';
import Coach from './pages/Coach';
import TV from './pages/TV';
import Clans from './pages/Clans';
import Login from './pages/Login';
import Signup from './pages/Signup';
import DebugFlow from './pages/DebugFlow';
import Benchmarks from './pages/Benchmarks';
import Install from './pages/Install';
import Feed from './pages/Feed';
import { Shield, Lock } from 'lucide-react';
import Onboarding from './components/Onboarding';
import { ToastProvider } from './context/ToastContext';
import { supabase } from './lib/supabase';
import { VisitorPermissions } from './types';

const VisitorBlockedPage = () => {
  const { logout } = useAuth();
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 bg-surface-container-low rounded-3xl border border-outline-variant/10 flex items-center justify-center mb-6">
        <Lock className="w-10 h-10 text-secondary animate-pulse" />
      </div>
      <h1 className="text-2xl font-headline font-black text-on-surface uppercase italic mb-2">Acesso Restrito</h1>
      <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest max-w-xs leading-relaxed">
        Você é um visitante e não tem permissão para acessar esta página.
      </p>
      <button
        onClick={() => logout()}
        className="mt-8 text-primary font-headline font-black uppercase italic text-sm hover:underline"
      >
        SAIR DA CONTA
      </button>
    </div>
  );
};

const VisitorGuard = ({ children, page }: { children: React.ReactNode; page: keyof VisitorPermissions }) => {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<VisitorPermissions | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role !== 'visitor') { setLoading(false); return; }
    supabase.from('box_settings').select('visitor_permissions').eq('is_active', true).maybeSingle().then(({ data }) => {
      if (data?.visitor_permissions) setPermissions(data.visitor_permissions);
      setLoading(false);
    });
  }, [user]);

  if (user?.role !== 'visitor') return <>{children}</>;
  if (loading) return null;
  if (!permissions || !permissions[page]) return <VisitorBlockedPage />;
  return <>{children}</>;
};

const ProtectedRoute = ({ children, roles }: { children: React.ReactNode; roles?: string[] }) => {
  const { user, loading, logout } = useAuth();

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center text-primary font-headline font-black text-2xl italic animate-pulse">
      CARREGANDO...
    </div>
  );
  if (!user) return <Navigate to="/login" />;

  if (user.status !== 'approved') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-surface-container-low rounded-3xl border border-outline-variant/10 flex items-center justify-center mb-6">
          <Shield className="w-10 h-10 text-primary animate-pulse" />
        </div>
        <h1 className="text-2xl font-headline font-black text-on-surface uppercase italic mb-2">Acesso Pendente</h1>
        <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest max-w-xs leading-relaxed">
          Sua conta foi criada com sucesso e está aguardando aprovação de um administrador.
        </p>
        <button
          onClick={() => logout()}
          className="mt-8 text-primary font-headline font-black uppercase italic text-sm hover:underline"
        >
          SAIR DA CONTA
        </button>
      </div>
    );
  }

  if (roles && !roles.includes(user.role)) return <Navigate to="/" />;
  return <>{children}</>;
};

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"   element={<Login />} />
        <Route path="/signup"  element={<Signup />} />
        <Route path="/install" element={<Install />} />
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="wod"         element={<VisitorGuard page="wod"><Wod /></VisitorGuard>} />
          <Route path="leaderboard" element={<VisitorGuard page="leaderboard"><Leaderboard /></VisitorGuard>} />
          <Route path="profile"     element={<Profile />} />
          <Route path="challenges"  element={<VisitorGuard page="challenges"><Challenges /></VisitorGuard>} />
          <Route path="duels"       element={<VisitorGuard page="duels"><Duels /></VisitorGuard>} />
          <Route path="progress"    element={<VisitorGuard page="progress"><Progress /></VisitorGuard>} />
          <Route path="mybox"       element={<VisitorGuard page="mybox"><MyBox /></VisitorGuard>} />
          <Route path="clans"       element={<VisitorGuard page="clans"><Clans /></VisitorGuard>} />
          <Route path="avatar"      element={<VisitorGuard page="avatar"><AvatarCustomization /></VisitorGuard>} />
          <Route path="benchmarks"  element={<VisitorGuard page="benchmarks"><Benchmarks /></VisitorGuard>} />
          <Route path="feed"        element={<VisitorGuard page="feed"><Feed /></VisitorGuard>} />
          <Route path="admin"       element={<ProtectedRoute roles={['admin']}><Admin /></ProtectedRoute>} />
          <Route path="coach"       element={<ProtectedRoute roles={['coach', 'admin']}><Coach /></ProtectedRoute>} />
          <Route path="tv"          element={<TV />} />
        </Route>
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  const { showOnboarding, completeOnboarding } = useAuth();
  return (
    <ToastProvider>
      <AppRoutes />
      <AnimatePresence>
        {showOnboarding && <Onboarding onComplete={completeOnboarding} />}
      </AnimatePresence>
    </ToastProvider>
  );
}
