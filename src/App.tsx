import React, { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';

const Dashboard = import.meta.env.VITE_APP_MODE !== 'individual'
  ? lazy(() => import('./pages/Dashboard'))
  : null;
const Wod = import.meta.env.VITE_APP_MODE !== 'individual'
  ? lazy(() => import('./pages/Wod'))
  : null;
const Challenges = import.meta.env.VITE_APP_MODE !== 'individual'
  ? lazy(() => import('./pages/Challenges'))
  : null;
const Leaderboard = import.meta.env.VITE_APP_MODE !== 'individual'
  ? lazy(() => import('./pages/Leaderboard'))
  : null;
const Duels = lazy(() => import('./pages/Duels'));
const MyBox = import.meta.env.VITE_APP_MODE !== 'individual'
  ? lazy(() => import('./pages/MyBox'))
  : null;
const Profile = lazy(() => import('./pages/Profile'));
const Progress = lazy(() => import('./pages/Progress'));
const AvatarCustomization = lazy(() => import('./pages/AvatarCustomization'));
const Admin = import.meta.env.VITE_APP_MODE !== 'individual'
  ? lazy(() => import('./pages/Admin'))
  : null;
const Coach = import.meta.env.VITE_APP_MODE !== 'individual'
  ? lazy(() => import('./pages/Coach'))
  : null;
const TV = import.meta.env.VITE_APP_MODE !== 'individual'
  ? lazy(() => import('./pages/TV'))
  : null;
const Clans = import.meta.env.VITE_APP_MODE !== 'individual'
  ? lazy(() => import('./pages/Clans'))
  : null;
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Benchmarks = lazy(() => import('./pages/Benchmarks'));
const Diario = lazy(() => import('./pages/Diario'));
const Liga = lazy(() => import('./pages/Liga'));
const Insights = lazy(() => import('./pages/Insights'));
const Frequencia = lazy(() => import('./pages/Frequencia'));
const Install = lazy(() => import('./pages/Install'));
const Feed = import.meta.env.VITE_APP_MODE !== 'individual'
  ? lazy(() => import('./pages/Feed'))
  : null;
const Shop = lazy(() => import('./pages/Shop'));
import { Shield, Lock, Building2 } from 'lucide-react';
import { isIndividualApp, isBoxApp } from './lib/appMode';
import Onboarding from './components/Onboarding';
import { ToastProvider } from './context/ToastContext';
import { NotificationsProvider } from './hooks/useNotifications';
import { supabase } from './lib/supabase';
import { VisitorPermissions } from './types';
import { reportRouteView } from './lib/observability';

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

const RouteLoading = () => (
  <div className="min-h-screen bg-background flex items-center justify-center text-primary font-headline font-black text-2xl italic animate-pulse" role="status" aria-live="polite">
    CARREGANDO...
  </div>
);

const RouteTelemetry = () => {
  const location = useLocation();
  useEffect(() => reportRouteView(location.pathname), [location.pathname]);
  return null;
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
  const value = permissions?.[page] as VisitorPermissions[keyof VisitorPermissions] | boolean | undefined;
  if (value !== 'allowed' && value !== true) return <VisitorBlockedPage />;
  return <>{children}</>;
};

const BoxOnlyGuard = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  if (user?.accountType === 'individual') return <Navigate to="/diario" replace />;
  return <>{children}</>;
};

const HomeRoute = () => {
  const { user } = useAuth();
  // A Início do individual é o /diario — no app dele o Dashboard nem existe.
  if (isIndividualApp || user?.accountType === 'individual') {
    return <Navigate to="/diario" replace />;
  }
  if (!Dashboard) return <Navigate to="/diario" replace />;
  return <Dashboard />;
};

/**
 * Conta de box abrindo o app do individual. Os dois compartilham o mesmo
 * backend, então o login funciona — mas aqui não existe nenhuma tela para ele.
 * Acontece de verdade quando um individual é aprovado num box: o account_type
 * vira 'box' e ele precisa migrar de app.
 */
const WrongAppScreen = () => {
  const { logout } = useAuth();
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 bg-surface-container-low rounded-3xl border border-outline-variant/10 flex items-center justify-center mb-6">
        <Building2 className="w-10 h-10 text-primary" />
      </div>
      <h1 className="text-2xl font-headline font-black text-on-surface uppercase italic mb-2">Você é aluno de um box</h1>
      <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest max-w-xs leading-relaxed">
        Esta conta faz parte de um box, então use o aplicativo BoxLink — lá estão a grade de aulas, o WOD do dia e o ranking da sua academia.
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

  // No app do individual, conta de box não tem para onde ir.
  if (isIndividualApp && user.accountType === 'box') return <WrongAppScreen />;

  if (roles && !roles.includes(user.role)) return <Navigate to="/" />;
  return <>{children}</>;
};

function AppRoutes() {
  return (
    <BrowserRouter>
      <RouteTelemetry />
      <Suspense fallback={<RouteLoading />}>
        <Routes>
        <Route path="/login"           element={<Login />} />
        <Route path="/signup"          element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password"  element={<ResetPassword />} />
        <Route path="/install"         element={<Install />} />
        {/* TV é telão de academia — não existe no app do individual. */}
        {isBoxApp && TV && <Route path="/tv" element={<TV />} />}
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<HomeRoute />} />
          {/* Comuns aos dois apps */}
          <Route path="profile"     element={<Profile />} />
          <Route path="diario"      element={<Diario />} />
          <Route path="liga"        element={<Liga />} />
          <Route path="insights"    element={<Insights />} />
          <Route path="frequencia"  element={<Frequencia />} />
          <Route path="duels"       element={<VisitorGuard page="duels"><Duels /></VisitorGuard>} />
          <Route path="progress"    element={<VisitorGuard page="progress"><Progress /></VisitorGuard>} />
          <Route path="avatar"      element={<VisitorGuard page="avatar"><AvatarCustomization /></VisitorGuard>} />
          <Route path="benchmarks"  element={<VisitorGuard page="benchmarks"><Benchmarks /></VisitorGuard>} />
          <Route path="shop"        element={<Shop />} />

          {/* Só o app do box: no build do individual estas rotas não existem,
              então nem o código delas entra no bundle publicado. */}
          {isBoxApp && Wod && Leaderboard && Challenges && MyBox && Clans && Feed && Admin && Coach && <>
            <Route path="wod"         element={<BoxOnlyGuard><VisitorGuard page="wod"><Wod /></VisitorGuard></BoxOnlyGuard>} />
            <Route path="leaderboard" element={<BoxOnlyGuard><VisitorGuard page="leaderboard"><Leaderboard /></VisitorGuard></BoxOnlyGuard>} />
            <Route path="challenges"  element={<BoxOnlyGuard><VisitorGuard page="challenges"><Challenges /></VisitorGuard></BoxOnlyGuard>} />
            <Route path="mybox"       element={<BoxOnlyGuard><VisitorGuard page="mybox"><MyBox /></VisitorGuard></BoxOnlyGuard>} />
            <Route path="clans"       element={<BoxOnlyGuard><VisitorGuard page="clans"><Clans /></VisitorGuard></BoxOnlyGuard>} />
            <Route path="feed"        element={<BoxOnlyGuard><VisitorGuard page="feed"><Feed /></VisitorGuard></BoxOnlyGuard>} />
            <Route path="admin"       element={<ProtectedRoute roles={['admin']}><Admin /></ProtectedRoute>} />
            <Route path="coach"       element={<ProtectedRoute roles={['coach', 'admin']}><Coach /></ProtectedRoute>} />
          </>}
        </Route>
        <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default function App() {
  const { showOnboarding, completeOnboarding } = useAuth();
  return (
    <NotificationsProvider>
      <ToastProvider>
        <AppRoutes />
        <AnimatePresence>
          {showOnboarding && <Onboarding onComplete={completeOnboarding} />}
        </AnimatePresence>
      </ToastProvider>
    </NotificationsProvider>
  );
}
