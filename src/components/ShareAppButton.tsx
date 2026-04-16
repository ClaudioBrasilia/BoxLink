import { useState } from 'react';
import { Share2, MessageCircle, Copy, Check } from 'lucide-react';
import { cn } from '../lib/utils';
import { shareToWhatsApp, getAppShareUrl, getAppShareMessage, copyToClipboard } from '../utils/share';
import { motion, AnimatePresence } from 'framer-motion';

export default function ShareAppButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleShareWhatsApp = () => {
    shareToWhatsApp({
      title: '🏋️ BoxLink - Arena de Fitness',
      text: getAppShareMessage(),
      url: getAppShareUrl(),
    });
    setIsOpen(false);
  };

  const handleCopyLink = async () => {
    const success = await copyToClipboard(`${getAppShareMessage()}\n\n${getAppShareUrl()}`);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-primary font-headline font-bold text-xs uppercase tracking-widest hover:bg-primary/20 transition-all"
      >
        <Share2 className="w-4 h-4" />
        COMPARTILHAR
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            className="absolute top-full right-0 mt-2 bg-surface-container-low rounded-2xl border border-outline-variant/10 shadow-lg p-2 z-50 w-48"
          >
            <button
              onClick={handleShareWhatsApp}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-surface-container-highest transition-all text-left"
            >
              <MessageCircle className="w-5 h-5 text-green-500" />
              <div className="flex-1">
                <p className="font-headline font-bold text-xs uppercase tracking-widest text-on-surface">WhatsApp</p>
                <p className="text-[10px] text-on-surface-variant">Compartilhar com amigos</p>
              </div>
            </button>

            <button
              onClick={handleCopyLink}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-surface-container-highest transition-all text-left"
            >
              {copied ? (
                <Check className="w-5 h-5 text-primary" />
              ) : (
                <Copy className="w-5 h-5 text-primary" />
              )}
              <div className="flex-1">
                <p className="font-headline font-bold text-xs uppercase tracking-widest text-on-surface">
                  {copied ? 'Copiado!' : 'Copiar Link'}
                </p>
                <p className="text-[10px] text-on-surface-variant">
                  {copied ? 'Link copiado para clipboard' : 'Copiar para compartilhar'}
                </p>
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
