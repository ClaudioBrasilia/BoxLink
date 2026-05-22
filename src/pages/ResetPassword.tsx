import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Shield, ChevronRight, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [validSession, setValidSession] = useState(false);
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();

  // O Supabase redireciona com um token na URL (hash ou query param).
  // Precisamos detectar a sessão de recuperação antes de exibir o form.
  useEffect(() => {
    const checkSession = async () => {
      // Supabase Auth v2 processa o token automaticamente via onAuthStateChange
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setValidSession(true);
      }
      setChecking(false);
    };

    // Escuta o evento PASSWORD_RECOVERY que o Supabase dispara ao abrir o link
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setValidSession(true);
        setChecking(false);
      }
    });

    checkSession();
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setError(error.message || 'Erro ao atualizar senha. Tente novamente.');
      } else {
        setDone(true);
        // Redireciona para login após 3 segundos
        setTimeout(() => navigate('/login'), 3000);
      }
    } catch {
      setError('Erro ao conectar com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-primary font-headline font-black text-2xl italic animate-pulse">
        VERIFICANDO...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md flex flex-col gap-8 relative z-10"
      >
        {/* Header */}
        <div className="text-center">
          <div className="w-24 h-24 bg-surface-container-low rounded-[2rem] border border-outline-variant/10 flex items-center justify-center mx-auto mb-6 shadow-2xl">
            <Shield className="w-12 h-12 text-primary" />
          </div>
          <h1 className="text-4xl font-headline font-black text-on-surface tracking-tighter uppercase italic">
            CROSSCITY <span className="text-primary">HUB</span>
          </h1>
          <p className="text-on-surface-variant text-xs font-bold tracking-widest uppercase mt-2 italic">
            Nova Senha
          </p>
        </div>

        <AnimatePresence mode="wait">
          {done ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-4 bg-surface-container-low border border-primary/20 rounded-3xl p-8 text-center"
            >
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-headline font-black text-on-surface uppercase italic">
                Senha Atualizada!
              </h2>
              <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest leading-relaxed">
                Sua senha foi redefinida com sucesso. Redirecionando para o login...
              </p>
            </motion.div>
          ) : !validSession ? (
            <motion.div
              key="invalid"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-4 bg-surface-container-low border border-error/20 rounded-3xl p-8 text-center"
            >
              <h2 className="text-lg font-headline font-black text-error uppercase italic">
                Link Inválido ou Expirado
              </h2>
              <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest leading-relaxed">
                Este link de recuperação não é válido ou já expirou. Solicite um novo link.
              </p>
              <Link
                to="/forgot-password"
                className="mt-2 bg-primary text-background px-6 py-3 rounded-2xl font-headline font-black text-sm uppercase italic shadow-lg hover:scale-[0.98] transition-all"
              >
                SOLICITAR NOVO LINK
              </Link>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              onSubmit={handleSubmit}
              className="flex flex-col gap-4"
            >
              <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest text-center leading-relaxed">
                Digite sua nova senha abaixo.
              </p>

              {/* Nova senha */}
              <div className="space-y-2">
                <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest ml-4">
                  Nova Senha
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant/10 rounded-2xl p-5 pr-14 font-headline font-bold text-on-surface focus:border-primary/50 transition-all outline-none"
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Confirmar senha */}
              <div className="space-y-2">
                <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest ml-4">
                  Confirmar Senha
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant/10 rounded-2xl p-5 pr-14 font-headline font-bold text-on-surface focus:border-primary/50 transition-all outline-none"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(v => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors"
                  >
                    {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Indicador de força */}
              {password.length > 0 && (
                <div className="flex gap-1 px-1">
                  {[1, 2, 3, 4].map(i => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-all ${
                        password.length >= i * 3
                          ? i <= 1 ? 'bg-error' : i <= 2 ? 'bg-secondary' : i <= 3 ? 'bg-primary/60' : 'bg-primary'
                          : 'bg-surface-container-highest'
                      }`}
                    />
                  ))}
                  <span className="text-[8px] font-black text-on-surface-variant uppercase tracking-widest ml-1 self-center">
                    {password.length < 4 ? 'FRACA' : password.length < 7 ? 'MÉDIA' : password.length < 10 ? 'BOA' : 'FORTE'}
                  </span>
                </div>
              )}

              {error && (
                <p className="text-center text-[10px] font-black text-error uppercase tracking-widest">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-background py-5 rounded-2xl font-headline font-black text-lg shadow-[0_10px_30px_rgba(202,253,0,0.2)] hover:scale-[0.98] active:scale-95 transition-all uppercase italic tracking-tight flex items-center justify-center gap-2 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'SALVANDO...' : 'SALVAR NOVA SENHA'} <ChevronRight className="w-5 h-5" />
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        {!done && (
          <div className="text-center">
            <Link
              to="/login"
              className="text-on-surface-variant text-xs font-bold uppercase tracking-widest hover:text-primary transition-colors"
            >
              Voltar para o Login
            </Link>
          </div>
        )}
      </motion.div>
    </div>
  );
}
