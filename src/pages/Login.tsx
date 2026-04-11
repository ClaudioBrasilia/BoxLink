import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn, UserPlus, Shield, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (user && !loading) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const { error } = await login(email, password);
      if (!error) {
        navigate('/');
      } else {
        setError(error.message || 'Credenciais inválidas');
      }
    } catch (e) {
      setError('Erro ao conectar com o servidor');
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md flex flex-col gap-8 relative z-10"
      >
        <div className="text-center">
          <div className="w-24 h-24 bg-surface-container-low rounded-[2rem] border border-outline-variant/10 flex items-center justify-center mx-auto mb-6 shadow-2xl">
            <Shield className="w-12 h-12 text-primary" />
          </div>
          <h1 className="text-4xl font-headline font-black text-on-surface tracking-tighter uppercase italic">CROSSCITY <span className="text-primary">HUB</span></h1>
          <p className="text-on-surface-variant text-xs font-bold tracking-widest uppercase mt-2 italic">A Arena Espera Por Você</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="space-y-2">
            <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest ml-4">Endereço de E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant/10 rounded-2xl p-5 font-headline font-bold text-on-surface focus:border-primary/50 transition-all outline-none"
              placeholder="atleta@crosscity.com"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest ml-4">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant/10 rounded-2xl p-5 font-headline font-bold text-on-surface focus:border-primary/50 transition-all outline-none"
              placeholder="••••••••"
              required
            />
          </div>
          {error && <p className="text-center text-[10px] font-black text-error uppercase tracking-widest">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-background py-5 rounded-2xl font-headline font-black text-lg shadow-[0_10px_30px_rgba(202,253,0,0.2)] hover:scale-[0.98] active:scale-95 transition-all uppercase italic tracking-tight flex items-center justify-center gap-2 mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'ENTRANDO...' : 'ENTRAR NA ARENA'} <ChevronRight className="w-5 h-5" />
          </button>
        </form>

        <div className="text-center">
          <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest">
            Novo no box? <Link to="/signup" className="text-primary hover:underline">Solicitar Acesso</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
