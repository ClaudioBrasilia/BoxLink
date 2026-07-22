import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, ChevronRight, Building2, Dumbbell } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accountType, setAccountType] = useState<'box' | 'individual'>('box');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const { signup, loading } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const { error } = await signup(email, password, name, accountType);
      if (!error) {
        setMessage(accountType === 'individual'
          ? 'Cadastro realizado! Sua conta individual já está liberada.'
          : 'Cadastro realizado com sucesso, aguardando aprovação');
        setTimeout(() => navigate('/login'), 3000);
      } else {
        setError(error.message || 'Erro ao realizar cadastro');
      }
    } catch (e) {
      setError('Erro ao conectar com o servidor');
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-secondary/10 rounded-full blur-[120px] pointer-events-none" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md flex flex-col gap-8 relative z-10"
      >
        <div className="text-center">
          <div className="w-24 h-24 bg-surface-container-low rounded-[2rem] border border-outline-variant/10 flex items-center justify-center mx-auto mb-6 shadow-2xl">
            <UserPlus className="w-12 h-12 text-secondary" />
          </div>
          <h1 className="text-4xl font-headline font-black text-on-surface tracking-tighter uppercase italic">ENTRE NO <span className="text-secondary">HUB</span></h1>
          <p className="text-on-surface-variant text-xs font-bold tracking-widest uppercase mt-2 italic">Solicite seu Acesso de Atleta</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="space-y-2">
            <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest ml-4">Como você treina?</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAccountType('box')}
                className={cn(
                  'flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all',
                  accountType === 'box'
                    ? 'bg-secondary/10 border-secondary text-secondary'
                    : 'bg-surface-container-low border-outline-variant/10 text-on-surface-variant'
                )}
              >
                <Building2 className="w-6 h-6" />
                <span className="text-[10px] font-black uppercase tracking-widest">Sou de um Box</span>
                <span className="text-[8px] font-bold uppercase tracking-wider opacity-60">Aprovação do admin</span>
              </button>
              <button
                type="button"
                onClick={() => setAccountType('individual')}
                className={cn(
                  'flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all',
                  accountType === 'individual'
                    ? 'bg-secondary/10 border-secondary text-secondary'
                    : 'bg-surface-container-low border-outline-variant/10 text-on-surface-variant'
                )}
              >
                <Dumbbell className="w-6 h-6" />
                <span className="text-[10px] font-black uppercase tracking-widest">Atleta Individual</span>
                <span className="text-[8px] font-bold uppercase tracking-wider opacity-60">Acesso imediato</span>
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest ml-4">Nome Completo</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant/10 rounded-2xl p-5 font-headline font-bold text-on-surface focus:border-secondary/50 transition-all outline-none"
              placeholder="João Silva"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest ml-4">Endereço de E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant/10 rounded-2xl p-5 font-headline font-bold text-on-surface focus:border-secondary/50 transition-all outline-none"
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
              className="w-full bg-surface-container-low border border-outline-variant/10 rounded-2xl p-5 font-headline font-bold text-on-surface focus:border-secondary/50 transition-all outline-none"
              placeholder="••••••••"
              required
            />
          </div>
          {error && <p className="text-center text-[10px] font-black text-error uppercase tracking-widest">{error}</p>}
          {message && <p className="text-center text-[10px] font-black text-primary uppercase tracking-widest">{message}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-secondary text-background py-5 rounded-2xl font-headline font-black text-lg shadow-[0_10px_30px_rgba(255,116,57,0.2)] hover:scale-[0.98] active:scale-95 transition-all uppercase italic tracking-tight flex items-center justify-center gap-2 mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'SOLICITANDO...' : 'SOLICITAR ACESSO'} <ChevronRight className="w-5 h-5" />
          </button>
        </form>

        <div className="text-center">
          <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest">
            Já é um atleta? <Link to="/login" className="text-secondary hover:underline">Fazer Login</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
