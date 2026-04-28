import { useState } from 'react';
import { Share2, Download, MessageCircle, Copy, Check, Image as ImageIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { generateRankingImage, downloadRankingImage, shareRankingToWhatsApp, copyImageToClipboard } from '../utils/rankingImage';
import { motion, AnimatePresence } from 'framer-motion';
import { User as UserType } from '../types';

interface ShareRankingButtonProps {
  top3: UserType[];
  rankingType: 'xp' | 'freq' | 'clans';
  title: string;
  boxName?: string;
}

export default function ShareRankingButton({ top3, rankingType, title, boxName }: ShareRankingButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerateImage = async () => {
    setIsGenerating(true);
    try {
      const imageUrl = await generateRankingImage({
        title,
        top3,
        rankingType,
        boxName,
      });
      setGeneratedImage(imageUrl);
    } catch (err) {
      console.error('Erro ao gerar imagem:', err);
      alert('Erro ao gerar imagem do ranking');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (generatedImage) {
      downloadRankingImage(generatedImage, `ranking-${rankingType}.png`);
    }
  };

  const handleShareWhatsApp = () => {
    if (generatedImage) {
      shareRankingToWhatsApp(generatedImage, title);
    }
  };

  const handleCopyImage = async () => {
    if (generatedImage) {
      const success = await copyImageToClipboard(generatedImage);
      if (success) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        alert('Seu navegador não suporta cópia de imagens. Tente fazer download e compartilhar manualmente.');
      }
    }
  };

  const handleShareInstagram = () => {
    if (generatedImage) {
      // Instagram não permite compartilhamento direto via URL
      // Copiamos a imagem para clipboard e abrimos o Instagram
      copyImageToClipboard(generatedImage).then((success) => {
        if (success) {
          alert('Imagem copiada! Cole no Instagram Stories ou Feed.');
          window.open('https://www.instagram.com/', '_blank');
        } else {
          alert('Faça download da imagem e compartilhe no Instagram manualmente.');
          handleDownload();
        }
      });
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary/10 text-secondary font-headline font-bold text-xs uppercase tracking-widest hover:bg-secondary/20 transition-all"
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
            className="absolute top-full right-0 mt-2 bg-surface-container-low rounded-2xl border border-outline-variant/10 shadow-lg p-2 z-50 w-56"
          >
            {!generatedImage ? (
              <button
                onClick={handleGenerateImage}
                disabled={isGenerating}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-surface-container-highest transition-all text-left disabled:opacity-50"
              >
                <ImageIcon className="w-5 h-5 text-secondary" />
                <div className="flex-1">
                  <p className="font-headline font-bold text-xs uppercase tracking-widest text-on-surface">
                    {isGenerating ? 'Gerando...' : 'Gerar Imagem'}
                  </p>
                  <p className="text-[10px] text-on-surface-variant">
                    {isGenerating ? 'Aguarde...' : 'Criar imagem do ranking'}
                  </p>
                </div>
              </button>
            ) : (
              <>
                <button
                  onClick={handleShareInstagram}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-surface-container-highest transition-all text-left"
                >
                  <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 flex items-center justify-center text-white text-xs font-bold">
                    📷
                  </div>
                  <div className="flex-1">
                    <p className="font-headline font-bold text-xs uppercase tracking-widest text-on-surface">Instagram</p>
                    <p className="text-[10px] text-on-surface-variant">Compartilhar nos Stories</p>
                  </div>
                </button>

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
                  onClick={handleCopyImage}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-surface-container-highest transition-all text-left"
                >
                  {copied ? (
                    <Check className="w-5 h-5 text-primary" />
                  ) : (
                    <Copy className="w-5 h-5 text-primary" />
                  )}
                  <div className="flex-1">
                    <p className="font-headline font-bold text-xs uppercase tracking-widest text-on-surface">
                      {copied ? 'Copiado!' : 'Copiar Imagem'}
                    </p>
                    <p className="text-[10px] text-on-surface-variant">
                      {copied ? 'Pronto para colar' : 'Para clipboard'}
                    </p>
                  </div>
                </button>

                <button
                  onClick={handleDownload}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-surface-container-highest transition-all text-left"
                >
                  <Download className="w-5 h-5 text-primary" />
                  <div className="flex-1">
                    <p className="font-headline font-bold text-xs uppercase tracking-widest text-on-surface">Download</p>
                    <p className="text-[10px] text-on-surface-variant">Salvar no dispositivo</p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setGeneratedImage(null);
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-surface-container-highest transition-all text-left text-on-surface-variant"
                >
                  <p className="font-headline font-bold text-xs uppercase tracking-widest">Voltar</p>
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview da imagem gerada */}
      <AnimatePresence>
        {generatedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setGeneratedImage(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-surface-container-low rounded-2xl border border-outline-variant/10 p-4 max-w-sm max-h-[80vh] overflow-auto"
            >
              <img src={generatedImage} alt="Ranking" className="w-full rounded-xl" />
              <button
                onClick={() => setGeneratedImage(null)}
                className="w-full mt-4 py-2 bg-primary text-background rounded-xl font-headline font-bold text-xs uppercase tracking-widest"
              >
                Fechar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
