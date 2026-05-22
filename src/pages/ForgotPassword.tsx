import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Shield, ChevronRight, ArrowLeft, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        setError(error.message || 'Erro ao enviar e-mail. Tente novamente.');
      } else {
        setSent(true);
      }
    } catch {
      setError('Erro ao conectar com o servidor.');
    } finally {
      setLoading(false);
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
        {/* Header */}
        <div className="text-center">
          <div className="w-24 h-24 bg-surface-container-low rounded-[2rem] border border-outline-variant/10 flex items-center justify-center mx-auto mb-6 shadow-2xl">
            <Shield className="w-12 h-12 text-primary" />
          </div>
          <h1 className="text-4xl font-headline font-black text-on-surface tracking-tighter uppercase italic">
            CROSSCITY <span className="text-primary">HUB</span>
          </h1>
          <p className="text-on-surface-variant text-xs font-bold tracking-widest uppercase mt-2 italic">
            Recuperar Acesso
          </p>
        </div>

        <AnimatePresence mode="wait">
          {!sent ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col gap-4"
            >
              <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest text-center leading-relaxed">
                Informe seu e-mail e enviaremos um link para redefinir sua senha.
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest ml-4">
                    Endereço de E-mail
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant/10 rounded-2xl p-5 font-headline font-bold text-on-surface focus:border-primary/50 transition-all outline-none"
                    placeholder="atleta@crosscity.com"
                    required
                  />
                </div>

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
                  {loading ? 'ENVIANDO...' : 'ENVIAR LINK'} <Mail className="w-5 h-5" />
                </button>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-4 bg-surface-container-low border border-primary/20 rounded-3xl p-8 text-center"
            >
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
                <Mail className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-headline font-black text-on-surface uppercase italic">
                E-mail Enviado!
              </h2>
              <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest leading-relaxed">
                Verifique sua caixa de entrada e clique no link para redefinir sua senha.
                <br /><br />
                Não recebeu? Verifique o spam ou tente novamente.
              </p>
              <button
                onClick={() => { setSent(false); setEmail(''); }}
                className="text-primary text-[10px] font-black uppercase tracking-widest hover:underline mt-2"
              >
                TENTAR NOVAMENTE
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Voltar para login */}
        <div className="text-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-on-surface-variant text-xs font-bold uppercase tracking-widest hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar para o Login
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
