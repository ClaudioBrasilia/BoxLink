import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import Login from './pages/Login';
import Signup from './pages/Signup';
import DebugFlow from './pages/DebugFlow';
import { Shield } from 'lucide-react';

const ProtectedRoute = ({ children, roles }: { children: React.ReactNode; roles?: string[] }) => {
  const { user, loading, logout } = useAuth();
  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center text-primary font-headline font-black text-2xl italic animate-pulse">CARREGANDO...</div>;
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

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/tv" element={<TV />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="wod" element={<Wod />} />
            <Route path="challenges" element={<Challenges />} />
            <Route path="leaderboard" element={<Leaderboard />} />
            <Route path="duels" element={<Duels />} />
            <Route path="mybox" element={<MyBox />} />
            <Route path="profile" element={<Profile />} />
            <Route path="progress" element={<Progress />} />
            <Route path="avatar" element={<AvatarCustomization />} />
            <Route path="debug-flow" element={<DebugFlow />} />
            <Route path="admin" element={<ProtectedRoute roles={['admin']}><Admin /></ProtectedRoute>} />
            <Route path="coach" element={<ProtectedRoute roles={['coach', 'admin']}><Coach /></ProtectedRoute>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
