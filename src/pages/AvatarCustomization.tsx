import { useState, useEffect, useRef } from 'react';
import { ShoppingBag, Package, Check, Coins, ChevronLeft, Sparkles, Shirt, Footprints, Glasses, GraduationCap, Watch, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Item, AvatarSlot } from '../types';
import AvatarPreview from '../components/AvatarPreview';
import { supabase } from '../lib/supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const BUCKET = 'avatar-assets';

/** Remove extensão .png do final da chave para evitar duplicidade ao montar a URL. */
function normalizeAvatarAssetKey(rawKey: string): string {
  return rawKey.replace(/\.png$/i, '');
}

function getItemImageUrl(imageKey: string): string {
  if (!imageKey) return '';
  if (imageKey.startsWith('http')) return imageKey;
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${encodeURIComponent(normalizeAvatarAssetKey(imageKey))}.png`;
}

const SLOT_ICONS: Record<string, any> = {
  top: Shirt, bottom: Footprints, shoes: Footprints,
  accessory: Glasses, head_accessory: GraduationCap, wrist_accessory: Watch, special: Sparkles,
};

const SLOT_LABELS: Record<string, string> = {
  top: 'Camiseta', bottom: 'Calça/Short', shoes: 'Tênis',
  accessory: 'Acessório', head_accessory: 'Cabeça', wrist_accessory: 'Pulso', special: 'Especial',
};

// ─── Página principal ─────────────────────────────────────────────────────────

export default function AvatarCustomization() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'inventory' | 'shop'>('inventory');
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<keyof AvatarSlot | 'all'>('all');
  const [avatarEnabled, setAvatarEnabled] = useState<boolean | null>(null);
  const [buyingItemId, setBuyingItemId] = useState<string | null>(null);
  const [equipingItemId, setEquipingItemId] = useState<string | null>(null);
  const [changingGender, setChangingGender] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const fetchData = async () => {
      const { data: settings } = await supabase.from('box_settings').select('avatar_enabled').maybeSingle();
      setAvatarEnabled(settings?.avatar_enabled ?? false);
      const { data } = await supabase.from('items').select('*');
      setItems(data || []);
      setLoading(false);
    };
    fetchData();
  }, []);

  const itemAdjustments = Object.fromEntries(
    items.filter(i => i.layer_adjustment).map(i => [i.id, i.layer_adjustment!])
  );

  const handleBuy = async (item: Item) => {
    if (!user || buyingItemId) return;
    if (user.coins < item.price) return;
    if (user.avatar?.inventory?.includes(item.id)) return;
    setBuyingItemId(item.id);
    try {
      const newCoins = user.coins - item.price;
      const newInventory = [...(user.avatar?.inventory || []), item.id];
      const { error } = await supabase.from('profiles').update({ coins: newCoins, avatar_inventory: newInventory, updated_at: new Date().toISOString() }).eq('id', user.id);
      if (error) throw error;
      updateUser({ ...user, coins: newCoins, avatar: { ...user.avatar, inventory: newInventory } });
      showToast(`${item.name} comprado! -${item.price} BC`);
    } catch { showToast('Erro ao comprar item.', 'error'); } finally { setBuyingItemId(null); }
  };

  const handleEquip = async (itemId: string | null, slot: keyof AvatarSlot) => {
    if (!user || equipingItemId) return;
    setEquipingItemId(itemId || slot);
    try {
      const newEquipped = { ...user.avatar.equipped, [slot]: itemId };
      const { error } = await supabase.from('profiles').update({ avatar_equipped: newEquipped, updated_at: new Date().toISOString() }).eq('id', user.id);
      if (error) throw error;
      updateUser({ ...user, avatar: { ...user.avatar, equipped: newEquipped } });
    } catch { showToast('Erro ao equipar item.', 'error'); } finally { setEquipingItemId(null); }
  };

  const filteredItems = items.filter(item => selectedSlot === 'all' || item.slot === selectedSlot);
  const inventoryItems = filteredItems.filter(item => user?.avatar.inventory.includes(item.id));
  const shopItems = filteredItems.filter(item => !user?.avatar.inventory.includes(item.id));

  if (loading || avatarEnabled === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background gap-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest">Carregando...</p>
      </div>
    );
  }

  if (!avatarEnabled) {
    return (
      <div className="flex flex-col gap-6 p-4 pt-8 min-h-screen bg-background">
        <header className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-3 bg-surface-container-low rounded-2xl border border-outline-variant/10 text-on-surface hover:bg-surface-container-highest transition-all">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-3xl font-headline font-black text-on-surface tracking-tight uppercase italic flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-primary" /> CUSTOMIZAR
          </h1>
        </header>
        <div className="bg-surface-container-low p-12 rounded-[2.5rem] border border-outline-variant/10 text-center flex flex-col items-center gap-4">
          <Sparkles className="w-12 h-12 text-on-surface-variant opacity-20" />
          <p className="text-on-surface font-headline font-bold uppercase italic tracking-widest">Em breve!</p>
          <button onClick={() => navigate(-1)} className="mt-2 px-6 py-3 bg-surface-container-highest rounded-2xl border border-outline-variant/10 text-on-surface font-bold uppercase text-xs tracking-widest hover:bg-surface-container-low transition-all">VOLTAR</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 pt-8 min-h-screen bg-background pb-24">

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity:0, y:-20 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-20 }}
            className={cn('fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest shadow-xl',
              toast.type === 'success' ? 'bg-primary text-on-primary' : 'bg-error text-on-error')}>
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      <header className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-3 bg-surface-container-low rounded-2xl border border-outline-variant/10 text-on-surface hover:bg-surface-container-highest transition-all">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-3xl font-headline font-black text-on-surface tracking-tight uppercase italic flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-primary" /> CUSTOMIZAR
        </h1>
      </header>

      {/* Avatar Preview */}
      <section className="bg-surface-container-low rounded-[2.5rem] border border-outline-variant/10 p-8 flex flex-col items-center gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-6">
          <div className="bg-secondary/20 px-4 py-2 rounded-full border border-secondary/30 flex items-center gap-2">
            <Coins className="w-4 h-4 text-secondary" />
            <span className="text-secondary text-sm font-black italic">{user?.coins} BC</span>
          </div>
        </div>

        <AvatarPreview equipped={user?.avatar.equipped!} size="xl" itemAdjustments={itemAdjustments} />

        {/* Seleção de gênero */}
        <div className="flex gap-2">
          {(['base_masculina', 'base_feminina'] as const).map((gender) => {
            const isActive = (user?.avatar.equipped?.base_outfit || 'base_masculina') === gender;
            return (
              <button key={gender} disabled={isActive || changingGender}
                onClick={async () => {
                  if (!user || isActive || changingGender) return;
                  setChangingGender(true);
                  try {
                    const newEquipped = { ...user.avatar.equipped, base_outfit: gender };
                    const { error } = await supabase.from('profiles').update({ avatar_equipped: newEquipped, updated_at: new Date().toISOString() }).eq('id', user.id);
                    if (error) throw error;
                    updateUser({ ...user, avatar: { ...user.avatar, equipped: newEquipped } });
                  } catch { showToast('Erro ao alterar avatar.', 'error'); } finally { setChangingGender(false); }
                }}
                className={cn('px-4 py-1.5 rounded-full font-bold uppercase text-[8px] tracking-widest border transition-all flex items-center gap-1.5 disabled:cursor-not-allowed',
                  isActive ? 'bg-primary text-on-primary border-primary shadow-lg shadow-primary/20' : 'bg-surface-container-low text-on-surface-variant border-outline-variant/10 hover:border-primary/30')}>
                {changingGender && !isActive ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                {gender === 'base_masculina' ? '♂ Masculino' : '♀ Feminino'}
              </button>
            );
          })}
        </div>

        <div className="text-center">
          <h2 className="text-2xl font-headline font-black text-on-surface italic uppercase tracking-tighter leading-none mb-1">{user?.name}</h2>
          <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest italic">NÍVEL {user?.level}</p>
        </div>
      </section>

      {/* Tabs & Filtros */}
      <div className="flex flex-col gap-4">
        <div className="flex bg-surface-container-low p-1.5 rounded-2xl border border-outline-variant/10">
          <button onClick={() => setActiveTab('inventory')}
            className={cn('flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold uppercase text-[10px] tracking-widest transition-all',
              activeTab === 'inventory' ? 'bg-primary text-on-primary shadow-lg shadow-primary/20' : 'text-on-surface-variant hover:bg-surface-container-highest')}>
            <Package className="w-4 h-4" /> MEU ARMÁRIO
          </button>
          <button onClick={() => setActiveTab('shop')}
            className={cn('flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold uppercase text-[10px] tracking-widest transition-all',
              activeTab === 'shop' ? 'bg-secondary text-on-secondary shadow-lg shadow-secondary/20' : 'text-on-surface-variant hover:bg-surface-container-highest')}>
            <ShoppingBag className="w-4 h-4" /> LOJA
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          <button onClick={() => setSelectedSlot('all')}
            className={cn('px-4 py-2 rounded-full font-bold uppercase text-[8px] tracking-widest whitespace-nowrap border transition-all',
              selectedSlot === 'all' ? 'bg-on-surface text-surface border-on-surface' : 'bg-surface-container-low text-on-surface-variant border-outline-variant/10')}>
            TODOS
          </button>
          {Object.entries(SLOT_LABELS).map(([slot, label]) => {
            const Icon = SLOT_ICONS[slot];
            return (
              <button key={slot} onClick={() => setSelectedSlot(slot as keyof AvatarSlot)}
                className={cn('px-4 py-2 rounded-full font-bold uppercase text-[8px] tracking-widest whitespace-nowrap border flex items-center gap-2 transition-all',
                  selectedSlot === slot ? 'bg-on-surface text-surface border-on-surface' : 'bg-surface-container-low text-on-surface-variant border-outline-variant/10')}>
                <Icon className="w-3 h-3" /> {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid de itens */}
      <section className="grid grid-cols-2 gap-4">
        <AnimatePresence mode="wait">
          {(activeTab === 'inventory' ? inventoryItems : shopItems).map((item) => {
            const isEquipped = user?.avatar.equipped[item.slot] === item.id;
            const canAfford = (user?.coins || 0) >= item.price;
            const isBuying = buyingItemId === item.id;
            const isEquiping = equipingItemId === item.id || equipingItemId === item.slot;

            return (
              <motion.div key={item.id} layout initial={{ opacity:0, scale:0.9 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0, scale:0.9 }}
                className={cn('bg-surface-container-low rounded-3xl border p-4 flex flex-col gap-3 transition-all relative group',
                  isEquipped ? 'border-primary bg-primary/5' : 'border-outline-variant/10 hover:border-primary/30')}>

                {isEquipped && (
                  <div className="absolute top-3 right-3 bg-primary text-on-primary p-1 rounded-full shadow-lg">
                    <Check className="w-3 h-3" />
                  </div>
                )}

                <div className="aspect-square rounded-2xl bg-surface-container-highest overflow-hidden group-hover:scale-105 transition-transform">
                  {item.image ? (
                    <img src={getItemImageUrl(item.image)} alt={item.name}
                      className="w-full h-full object-cover object-top"
                      onError={e => { e.currentTarget.style.display = 'none'; }} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Sparkles className="w-8 h-8 text-on-surface-variant opacity-30" />
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="text-on-surface font-bold uppercase text-[10px] italic leading-tight">{item.name}</h4>
                  <p className="text-on-surface-variant text-[8px] font-bold uppercase tracking-widest mt-0.5 opacity-50">
                    {SLOT_LABELS[item.slot]}
                  </p>
                </div>

                {activeTab === 'inventory' ? (
                  <button onClick={() => handleEquip(isEquipped ? null : item.id, item.slot)} disabled={!!equipingItemId}
                    className={cn('w-full py-2 rounded-xl font-black uppercase text-[8px] tracking-widest transition-all flex items-center justify-center gap-1.5 disabled:opacity-60',
                      isEquipped ? 'bg-surface-container-highest text-on-surface-variant' : 'bg-primary text-on-primary shadow-lg shadow-primary/20')}>
                    {isEquiping ? <Loader2 className="w-3 h-3 animate-spin" /> : isEquipped ? 'REMOVER' : 'EQUIPAR'}
                  </button>
                ) : (
                  <button onClick={() => handleBuy(item)} disabled={!canAfford || !!buyingItemId}
                    className={cn('w-full py-2 rounded-xl font-black uppercase text-[8px] tracking-widest transition-all flex items-center justify-center gap-1.5',
                      canAfford && !buyingItemId ? 'bg-secondary text-on-secondary shadow-lg shadow-secondary/20' : 'bg-surface-container-highest text-on-surface-variant opacity-50 cursor-not-allowed')}>
                    {isBuying ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Coins className="w-3 h-3" /> {item.price} BC</>}
                  </button>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {activeTab === 'inventory' && inventoryItems.length === 0 && !loading && (
          <div className="col-span-2 bg-surface-container-low p-12 rounded-[2.5rem] border border-outline-variant/10 text-center">
            <Package className="w-12 h-12 text-on-surface-variant opacity-20 mx-auto mb-4" />
            <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest italic">Seu armário está vazio</p>
            <button onClick={() => setActiveTab('shop')} className="mt-4 text-primary text-[10px] font-black uppercase tracking-widest hover:underline">VISITAR A LOJA</button>
          </div>
        )}
        {activeTab === 'shop' && shopItems.length === 0 && !loading && (
          <div className="col-span-2 bg-surface-container-low p-12 rounded-[2.5rem] border border-outline-variant/10 text-center">
            <ShoppingBag className="w-12 h-12 text-on-surface-variant opacity-20 mx-auto mb-4" />
            <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest italic">
              {items.length === 0 ? 'Nenhum item disponível ainda' : 'Você já tem todos os itens!'}
            </p>
          </div>
        )}
      </section>
    </div>
  );
      }
