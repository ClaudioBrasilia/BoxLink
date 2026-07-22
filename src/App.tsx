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
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import DebugFlow from './pages/DebugFlow';
import Benchmarks from './pages/Benchmarks';
import Diario from './pages/Diario';
import Liga from './pages/Liga';
import Insights from './pages/Insights';
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
  // 'blocked' e 'hidden' são strings truthy — a checagem precisa ser explícita.
  // `true` cobre registros antigos que guardavam boolean no banco.
  const value = permissions?.[page] as VisitorPermissions[keyof VisitorPermissions] | boolean | undefined;
  if (value !== 'allowed' && value !== true) return <VisitorBlockedPage />;
  return <>{children}</>;
};

/**
 * Bloqueia páginas exclusivas do Box para contas individuais.
 * O atleta individual não é cadastrado em nenhum box, então não acessa
 * WOD do box, ranking, desafios, meu box, times ou feed — é redirecionado
 * para o próprio Diário.
 */
const BoxOnlyGuard = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  if (user?.accountType === 'individual') return <Navigate to="/diario" replace />;
  return <>{children}</>;
};

/** Home: individual cai no Diário; conta de box vê o Dashboard do box. */
const HomeRoute = () => {
  const { user } = useAuth();
  if (user?.accountType === 'individual') return <Navigate to="/diario" replace />;
  return <Dashboard />;
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
        <Route path="/login"           element={<Login />} />
        <Route path="/signup"          element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password"  element={<ResetPassword />} />
        <Route path="/install"         element={<Install />} />
        <Route path="/tv"              element={<TV />} />
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<HomeRoute />} />
          <Route path="wod"         element={<BoxOnlyGuard><VisitorGuard page="wod"><Wod /></VisitorGuard></BoxOnlyGuard>} />
          <Route path="leaderboard" element={<BoxOnlyGuard><VisitorGuard page="leaderboard"><Leaderboard /></VisitorGuard></BoxOnlyGuard>} />
          <Route path="profile"     element={<Profile />} />
          <Route path="diario"      element={<Diario />} />
          <Route path="liga"        element={<Liga />} />
          <Route path="insights"    element={<Insights />} />
          <Route path="challenges"  element={<BoxOnlyGuard><VisitorGuard page="challenges"><Challenges /></VisitorGuard></BoxOnlyGuard>} />
          <Route path="duels"       element={<VisitorGuard page="duels"><Duels /></VisitorGuard>} />
          <Route path="progress"    element={<VisitorGuard page="progress"><Progress /></VisitorGuard>} />
          <Route path="mybox"       element={<BoxOnlyGuard><VisitorGuard page="mybox"><MyBox /></VisitorGuard></BoxOnlyGuard>} />
          <Route path="clans"       element={<BoxOnlyGuard><VisitorGuard page="clans"><Clans /></VisitorGuard></BoxOnlyGuard>} />
          <Route path="avatar"      element={<VisitorGuard page="avatar"><AvatarCustomization /></VisitorGuard>} />
          <Route path="benchmarks"  element={<VisitorGuard page="benchmarks"><Benchmarks /></VisitorGuard>} />
          <Route path="feed"        element={<BoxOnlyGuard><VisitorGuard page="feed"><Feed /></VisitorGuard></BoxOnlyGuard>} />
          <Route path="admin"       element={<ProtectedRoute roles={['admin']}><Admin /></ProtectedRoute>} />
          <Route path="coach"       element={<ProtectedRoute roles={['coach', 'admin']}><Coach /></ProtectedRoute>} />
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
