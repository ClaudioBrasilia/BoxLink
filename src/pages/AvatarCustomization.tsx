import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, 
  Sparkles, 
  Crown, 
  Coins, 
  Save, 
  Image as ImageIcon,
  Check,
  History,
  Lock,
  ArrowRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { AvatarSlot, User } from '../types';
import { cn } from '../lib/utils';
import confetti from 'canvas-confetti';
import AvatarPreview from '../components/AvatarPreview';

const BUCKET = 'avatar-assets';

// Itens disponíveis para customização (Exemplo de estrutura)
const CATEGORIES = [
  { id: 'base', label: 'Corpo', icon: ImageIcon },
  { id: 'hair', label: 'Cabelo', icon: Sparkles },
  { id: 'top', label: 'Camisa', icon: Sparkles },
  { id: 'bottom', label: 'Calça', icon: Sparkles },
  { id: 'accessory', label: 'Acessório', icon: Sparkles },
  { id: 'special', label: 'Especial', icon: Crown },
];

export default function AvatarCustomization() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState('base');
  const [isSaving, setIsSaving] = useState(false);
  const [equipped, setEquipped] = useState<AvatarSlot>(user?.avatar.equipped || {} as AvatarSlot);

  // Sincroniza o estado local quando o usuário carregar
  useEffect(() => {
    if (user?.avatar.equipped) {
      setEquipped(user.avatar.equipped);
    }
  }, [user]);

  const handleSelectItem = (category: string, itemKey: string) => {
    setEquipped(prev => ({
      ...prev,
      [category]: itemKey
    }));
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          avatar: {
            ...user.avatar,
            equipped: equipped
          }
        })
        .eq('id', user.id);

      if (error) throw error;
      
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#00FF9D', '#00E5FF', '#FFFFFF']
      });
      
      await refreshUser();
      setTimeout(() => navigate('/profile'), 1500);
    } catch (err) {
      console.error('Erro ao salvar avatar:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md px-4 py-4 flex items-center gap-4">
        <button 
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-black italic tracking-tighter text-on-background uppercase">
          Customização
        </h1>
      </header>

      <div className="px-4 max-w-lg mx-auto">
        {/* Preview Area */}
        <div className="relative aspect-square rounded-3xl bg-surface-container-low overflow-hidden border-2 border-primary/20 p-8 flex items-center justify-center mb-8">
          <AvatarPreview 
            equipped={equipped} 
            size="xl" 
            className="w-64 h-64 bg-transparent shadow-2xl scale-125"
          />
          
          <div className="absolute top-4 right-4 bg-primary/10 px-3 py-1 rounded-full border border-primary/20 backdrop-blur-sm">
            <span className="text-[10px] font-black text-primary uppercase">Estilo Atual</span>
          </div>
        </div>

        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar mb-6">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveTab(cat.id)}
              className={cn(
                "flex-shrink-0 px-4 py-3 rounded-2xl flex items-center gap-2 transition-all duration-300",
                activeTab === cat.id 
                  ? "bg-primary text-primary-fixed block-shadow" 
                  : "bg-surface-container-highest text-on-surface-variant hover:bg-surface-container-high"
              )}
            >
              <cat.icon className="w-5 h-5" />
              <span className="text-sm font-bold uppercase tracking-tight">{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Item Selection (Exemplo simplificado de itens) */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {/* Aqui você pode mapear os itens que tem no seu banco de dados ou lista fixa */}
          {/* Abaixo um botão de exemplo para remover o item da categoria */}
          <button
            onClick={() => handleSelectItem(activeTab, '')}
            className="aspect-square rounded-2xl border-2 border-dashed border-outline-variant flex flex-col items-center justify-center gap-1 text-on-surface-variant"
          >
            <span className="text-[10px] font-black uppercase">Nenhum</span>
          </button>
          
          {/* Exemplo de item: Se for Masculino/Feminino trocamos a base */}
          {activeTab === 'base' && (
            <>
              <button
                onClick={() => handleSelectItem('base_outfit', 'base_masculina')}
                className={cn(
                  "aspect-square rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all",
                  equipped.base_outfit === 'base_masculina' ? "border-primary bg-primary/10" : "border-transparent bg-surface-container"
                )}
              >
                <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <ArrowRight className="w-6 h-6 text-blue-400" />
                </div>
                <span className="text-[10px] font-black uppercase">Masculino</span>
              </button>
              <button
                onClick={() => handleSelectItem('base_outfit', 'base_feminina')}
                className={cn(
                  "aspect-square rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all",
                  equipped.base_outfit === 'base_feminina' ? "border-primary bg-primary/10" : "border-transparent bg-surface-container"
                )}
              >
                <div className="w-12 h-12 rounded-full bg-pink-500/20 flex items-center justify-center">
                  <ArrowRight className="w-6 h-6 text-pink-400" />
                </div>
                <span className="text-[10px] font-black uppercase">Feminino</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Footer Save Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-md border-t border-outline-variant/30 flex justify-center">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full max-w-lg h-14 bg-primary text-primary-fixed rounded-2xl font-black uppercase tracking-widest block-shadow flex items-center justify-center gap-3 disabled:opacity-50"
        >
          {isSaving ? (
            <div className="w-6 h-6 border-4 border-primary-fixed/30 border-t-primary-fixed rounded-full animate-spin" />
          ) : (
            <>
              <Save className="w-6 h-6" />
              <span>Salvar Alterações</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
