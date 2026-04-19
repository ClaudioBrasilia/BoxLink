import { useState, useEffect } from 'react';
import { Download, Share, Smartphone, Monitor, Apple, Chrome, CheckCircle, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function Install() {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop');

  useEffect(() => {
    const ua = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua)) setPlatform('ios');
    else if (/android/i.test(ua)) setPlatform('android');
    else setPlatform('desktop');

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);

    if (window.matchMedia('(display-mode: standalone)').matches) setIsInstalled(true);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setIsInstalled(true);
    setDeferredPrompt(null);
  };

  const Step = ({ n, text }: { n: number; text: React.ReactNode }) => (
    <div className="flex gap-4 items-start">
      <div className="w-8 h-8 rounded-full bg-primary text-background flex items-center justify-center font-headline font-black text-sm shrink-0">{n}</div>
      <p className="text-sm text-on-surface-variant font-bold leading-relaxed pt-1">{text}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md flex flex-col gap-6"
      >
        {/* Header */}
        <div className="text-center">
          <div className="text-6xl mb-4">📲</div>
          <h1 className="text-4xl font-headline font-black text-on-surface uppercase italic tracking-tight">
            INSTALAR <span className="text-primary">BOXLINK</span>
          </h1>
          <p className="text-on-surface-variant text-sm font-bold uppercase tracking-widest mt-2">
            Tenha o app na tela inicial do seu celular
          </p>
        </div>

        {/* Benefits */}
        <div className="bg-primary/10 border border-primary/20 rounded-3xl p-5 flex flex-col gap-3">
          {[
            { icon: '⚡', text: 'Abre instantaneamente, sem abrir o navegador' },
            { icon: '📴', text: 'Funciona offline — veja o WOD sem internet' },
            { icon: '🔔', text: 'Notificações de novos WODs e duelos' },
            { icon: '💪', text: 'Experiência igual a um app nativo' },
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <span className="text-xl">{icon}</span>
              <p className="text-xs font-bold text-on-surface uppercase tracking-widest">{text}</p>
            </div>
          ))}
        </div>

        {/* Install section */}
        {isInstalled ? (
          <div className="bg-surface-container-low rounded-3xl border border-primary/30 p-8 flex flex-col items-center gap-4 text-center">
            <CheckCircle className="w-16 h-16 text-primary" />
            <h2 className="text-2xl font-headline font-black text-on-surface uppercase italic">App Instalado!</h2>
            <p className="text-on-surface-variant text-sm font-bold uppercase tracking-widest">
              Abra o BoxLink pela tela inicial do seu dispositivo.
            </p>
          </div>
        ) : (
          <div className="bg-surface-container-low rounded-3xl border border-outline-variant/10 p-6 flex flex-col gap-5">

            {/* Android/Desktop — botão nativo */}
            {deferredPrompt && (
              <button onClick={handleInstall}
                className="w-full bg-primary text-background py-5 rounded-2xl font-headline font-black text-lg uppercase italic shadow-lg hover:scale-[0.98] active:scale-95 transition-all flex items-center justify-center gap-3">
                <Download className="w-5 h-5" /> INSTALAR AGORA
              </button>
            )}

            {/* iOS */}
            {platform === 'ios' && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 p-4 bg-surface-container-highest/50 rounded-2xl">
                  <Apple className="w-6 h-6 text-primary shrink-0" />
                  <div>
                    <p className="font-headline font-black text-on-surface text-sm uppercase italic">iPhone / iPad</p>
                    <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Siga os passos:</p>
                  </div>
                </div>
                <div className="flex flex-col gap-3 px-1">
                  <Step n={1} text={<>Toque no ícone de <strong className="text-on-surface">Compartilhar</strong> <Share className="w-3 h-3 inline" /> no Safari</>} />
                  <Step n={2} text={<>Role e toque em <strong className="text-on-surface">"Adicionar à Tela de Início"</strong></>} />
                  <Step n={3} text={<>Confirme tocando em <strong className="text-on-surface">"Adicionar"</strong></>} />
                </div>
              </div>
            )}

            {/* Android sem prompt */}
            {platform === 'android' && !deferredPrompt && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 p-4 bg-surface-container-highest/50 rounded-2xl">
                  <Chrome className="w-6 h-6 text-primary shrink-0" />
                  <div>
                    <p className="font-headline font-black text-on-surface text-sm uppercase italic">Android — Chrome</p>
                    <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Siga os passos:</p>
                  </div>
                </div>
                <div className="flex flex-col gap-3 px-1">
                  <Step n={1} text={<>Toque no menu <strong className="text-on-surface">⋮</strong> do Chrome</>} />
                  <Step n={2} text={<>Toque em <strong className="text-on-surface">"Instalar aplicativo"</strong> ou <strong className="text-on-surface">"Adicionar à tela inicial"</strong></>} />
                  <Step n={3} text={<>Confirme e o app aparecerá na sua tela inicial</>} />
                </div>
              </div>
            )}

            {/* Desktop */}
            {platform === 'desktop' && !deferredPrompt && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 p-4 bg-surface-container-highest/50 rounded-2xl">
                  <Monitor className="w-6 h-6 text-primary shrink-0" />
                  <div>
                    <p className="font-headline font-black text-on-surface text-sm uppercase italic">Desktop</p>
                    <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Melhor no celular!</p>
                  </div>
                </div>
                <p className="text-xs text-on-surface-variant font-bold uppercase tracking-widest text-center">
                  Acesse pelo celular para instalar:
                </p>
                <div className="bg-surface-container-highest rounded-2xl p-3 text-center border border-outline-variant/10">
                  <code className="text-primary text-sm font-bold break-all">{window.location.origin}/install</code>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-2xl border border-primary/10">
              <Smartphone className="w-4 h-4 text-primary shrink-0" />
              <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">
                Gratuito · Sem loja de apps · Instala em segundos
              </p>
            </div>
          </div>
        )}

        {/* Back button */}
        <button onClick={() => navigate('/')}
          className="w-full py-4 bg-surface-container-low border border-outline-variant/10 rounded-2xl font-headline font-black text-sm uppercase italic text-on-surface-variant hover:text-on-surface transition-all">
          VOLTAR AO APP
        </button>
      </motion.div>
    </div>
  );
}
