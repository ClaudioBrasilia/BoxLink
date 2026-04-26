import { useState, useEffect } from 'react';
import { ShoppingBag, Package, Check, Coins, ChevronLeft, Sparkles, Shirt, Footprints, Glasses, GraduationCap, Watch, X, Eye } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Item, AvatarSlot } from '../types';
import { supabase } from '../lib/supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const BUCKET = 'avatar-assets';

// Função para obter URL da imagem com fallback
function getItemImageUrl(imageKey: string | undefined): string {
  if (!imageKey) return '';
  if (imageKey.startsWith('http')) return imageKey;
  
  const cleanKey = imageKey.toLowerCase().replace(/\s+/g, '_');
  
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${cleanKey}.png`;
}

// Função para obter imagem base (avatar sem itens)
function getBaseImageUrl(equipped: AvatarSlot): string {
  const isFemale = equipped?.base_outfit === 'base_female' || 
                    equipped?.base_outfit?.includes('female') ||
                    equipped?.base_outfit?.toLowerCase().includes('feminina');
  
  const base = isFemale ? 'base_feminina' : 'base_masculina';
  return getItemImageUrl(base);
}

const SLOT_ICONS: Record<string, any> = {
  top: Shirt,
  bottom: Footprints,
  shoes: Footprints,
  accessory: Glasses,
  head_accessory: GraduationCap,
  wrist_accessory: Watch,
  special: Sparkles,
};

const SLOT_LABELS: Record<string, string> = {
  top: 'Camiseta',
  bottom: 'Calça/Short',
  shoes: 'Tênis',
  accessory: 'Acessório',
  head_accessory: 'Cabeça',
  wrist_accessory: 'Pulso',
  special: 'Especial',
};

// Modal de preview
function ItemPreviewModal({
  item,
  equipped,
  items,
  onClose,
  onBuy,
  onEquip,
  inInventory,
  canAfford,
}: {
  item: Item;
  equipped: AvatarSlot;
  items: Item[];
  onClose: () => void;
  onBuy: (item: Item) => void;
  onEquip: (itemId: string | null, slot: keyof AvatarSlot) => void;
  inInventory: boolean;
  canAfford: boolean;
}) {
  const isEquipped = equipped[item.slot] === item.id;
  const previewImageUrl = getItemImageUrl(item.image);
  const [imgError, setImgError] = useState(false);

  const otherEquippedItems = items.filter(i =>
    i.slot !== item.slot && equipped[i.slot] === i.id
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-background/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 60 }}
        className="w-full sm:max-w-sm bg-surface-container-low rounded-t-[2.5rem] sm:rounded-[2.5rem] border border-outline-variant/10 shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between p-6 pb-0">
          <div>
            <h3 className="text-lg font-headline font-black text-on-surface italic uppercase leading-none">
              {item.name}
            </h3>
            <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest mt-0.5">
              {SLOT_LABELS[item.slot]}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-surface-container-highest rounded-xl text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative mx-6 mt-4 rounded-3xl bg-surface-container-highest overflow-hidden flex items-center justify-center" style={{ height: '320px' }}>
          {!imgError && previewImageUrl ? (
            <img
              src={previewImageUrl}
              alt={item.name}
              className="h-full w-full object-contain object-top"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2">
              <ShoppingBag className="w-16 h-16 text-on-surface-variant/30" />
              <p className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest">Item sem prévia</p>
            </div>
          )}

          <div className="absolute top-3 left-3 bg-primary/90 text-on-primary px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-1">
            <Eye className="w-3 h-3" /> PREVIEW
          </div>

          {isEquipped && (
            <div className="absolute top-3 right-3 bg-primary text-on-primary p-1.5 rounded-full shadow-lg">
              <Check className="w-4 h-4" />
            </div>
          )}
        </div>

        {otherEquippedItems.length > 0 && (
          <div className="mx-6 mt-3">
            <p className="text-[8px] text-on-surface-variant font-bold uppercase tracking-widest mb-2">Também equipado:</p>
            <div className="flex gap-2 flex-wrap">
              {otherEquippedItems.map(i => (
                <div key={i.id} className="flex items-center gap-1.5 bg-surface-container-highest px-2 py-1 rounded-full">
                  <img
                    src={getItemImageUrl(i.image)}
                    alt={i.name}
                    className="w-5 h-5 object-contain rounded-full"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                  <span className="text-[8px] font-black text-on-surface-variant uppercase tracking-widest">{i.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="p-6 pt-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 bg-secondary/20 px-4 py-2 rounded-full border border-secondary/30">
              <Coins className="w-4 h-4 text-secondary" />
              <span className="text-secondary font-black italic">{item.price} BC</span>
            </div>
          </div>

          {inInventory ? (
            <button
              onClick={() => { onEquip(isEquipped ? null : item.id, item.slot); onClose(); }}
              className={cn(
                'w-full py-3 rounded-2xl font-black uppercase text-sm tracking-widest transition-all',
                isEquipped
                  ? 'bg-surface-container-highest text-on-surface-variant'
                  : 'bg-primary text-on-primary shadow-lg shadow-primary/20'
              )}
            >
              {isEquipped ? 'REMOVER' : 'EQUIPAR'}
            </button>
          ) : (
            <button
              onClick={() => { if (canAfford) { onBuy(item); onClose(); } }}
              disabled={!canAfford}
              className={cn(
                'w-full py-3 rounded-2xl font-black uppercase text-sm tracking-widest transition-all flex items-center justify-center gap-2',
                canAfford
                  ? 'bg-secondary text-on-secondary shadow-lg shadow-secondary/20'
                  : 'bg-surface-container-highest text-on-surface-variant opacity-50 cursor-not-allowed'
              )}
            >
              <Coins className="w-4 h-4" />
              {canAfford ? `COMPRAR POR ${item.price} BC` : 'COINS INSUFICIENTES'}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default function AvatarCustomization() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'inventory' | 'shop'>('inventory');
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<keyof AvatarSlot | 'all'>('all');
  const [avatarEnabled, setAvatarEnabled] = useState<boolean | null>(null);
  const [previewItem, setPreviewItem] = useState<Item | null>(null);
  const [avatarImageError, setAvatarImageError] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      const { data: settingsData } = await supabase
        .from('box_settings')
        .select('avatar_enabled')
        .single();
      setAvatarEnabled(settingsData?.avatar_enabled ?? false);

      const { data: itemsData } = await supabase.from('items').select('*');
      setItems(itemsData || []);
      setLoading(false);
    };
    fetchAll();
  }, []);

  const handleBuy = async (item: Item) => {
    if (!user) return;
    if (user.coins < item.price) return;
    try {
      const newCoins = user.coins - item.price;
      const newInventory = [...(user.avatar?.inventory || []), item.id];
      const { error } = await supabase
        .from('profiles')
        .update({ coins: newCoins, avatar_inventory: newInventory, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      if (!error) updateUser({ ...user, coins: newCoins, avatar: { ...user.avatar, inventory: newInventory } });
    } catch (err) { console.error(err); }
  };

  const handleEquip = async (itemId: string | null, slot: keyof AvatarSlot) => {
    if (!user) return;
    try {
      const newEquipped = { ...user.avatar.equipped, [slot]: itemId };
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_equipped: newEquipped, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      if (!error) updateUser({ ...user, avatar: { ...user.avatar, equipped: newEquipped } });
    } catch (err) { console.error(err); }
  };

  const handleBaseChange = async (gender: 'base_female' | 'base_male') => {
    if (!user) return;
    try {
      const newEquipped = { ...user.avatar.equipped, base_outfit: gender };
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_equipped: newEquipped, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      if (!error) updateUser({ ...user, avatar: { ...user.avatar, equipped: newEquipped } });
    } catch (err) { console.error(err); }
  };

  if (avatarEnabled === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!avatarEnabled) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background gap-6 p-8">
        <Sparkles className="w-16 h-16 text-primary opacity-30" />
        <div className="text-center">
          <h2 className="text-2xl font-headline font-black text-on-surface italic uppercase tracking-tighter leading-none mb-2">Em breve!</h2>
          <p className="text-on-surface-variant text-sm">O sistema de avatar está sendo preparado. Volte em breve!</p>
        </div>
        <button onClick={() => navigate(-1)} className="px-6 py-3 bg-surface-container-low rounded-2xl border border-outline-variant/10 text-on-surface font-bold uppercase text-xs tracking-widest hover:bg-surface-container-highest transition-all">
          Voltar
        </button>
      </div>
    );
  }

  const filteredItems = items.filter(item => selectedSlot === 'all' || item.slot === selectedSlot);
  const inventoryItems = filteredItems.filter(item => user?.avatar.inventory.includes(item.id));
  const shopItems = filteredItems.filter(item => !user?.avatar.inventory.includes(item.id));

  const getAvatarPreviewUrl = () => {
    const eq = user?.avatar.equipped;
    
    if (eq) {
      const slots: (keyof AvatarSlot)[] = ['top', 'bottom', 'shoes', 'special', 'accessory', 'head_accessory', 'wrist_accessory'];
      for (const slot of slots) {
        const itemId = eq[slot];
        if (itemId) {
          const item = (items || []).find(i => i.id === itemId);
          if (item?.image) {
            return getItemImageUrl(item.image);
          }
        }
      }
    }
    
    return getBaseImageUrl(eq || {} as AvatarSlot);
  };
  
  const avatarPreviewUrl = getAvatarPreviewUrl();

  return (
    <div className="flex flex-col gap-6 p-4 pt-8 min-h-screen bg-background pb-24">
      <header className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-3 bg-surface-container-low rounded-2xl border border-outline-variant/10 text-on-surface hover:bg-surface-container-highest transition-all">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-3xl font-headline font-black text-on-surface tracking-tight uppercase italic flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-primary" /> CUSTOMIZAR
        </h1>
      </header>

      {/* Seletor de Base */}
      <div className="flex items-center gap-3 px-1">
        <span className="text-[9px] text-on-surface-variant font-bold uppercase tracking-widest whitespace-nowrap">Base:</span>
        <div className="flex bg-surface-container-low p-1 rounded-2xl border border-outline-variant/10 gap-1">
          {(['base_female', 'base_male'] as const).map((gender) => {
            const isActive = (user?.avatar.equipped?.base_outfit === gender) ||
              (!user?.avatar.equipped?.base_outfit && gender === 'base_male');
            const label = gender === 'base_female' ? '♀ Feminino' : '♂ Masculino';
            return (
              <button
                key={gender}
                onClick={() => handleBaseChange(gender)}
                className={cn(
                  'px-4 py-2 rounded-xl font-bold uppercase text-[10px] tracking-widest transition-all flex items-center gap-1.5',
                  isActive
                    ? 'bg-primary text-on-primary shadow-md shadow-primary/20'
                    : 'text-on-surface-variant hover:bg-surface-container-highest'
                )}
              >
                {isActive && <Check className="w-3 h-3" />}
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Avatar Preview Section */}
      <section className="bg-surface-container-low rounded-[2.5rem] border border-outline-variant/10 p-6 flex gap-6 relative overflow-hidden items-center">
        <div className="absolute top-0 right-0 p-4">
          <div className="bg-secondary/20 px-4 py-2 rounded-full border border-secondary/30 flex items-center gap-2">
            <Coins className="w-4 h-4 text-secondary" />
            <span className="text-secondary text-sm font-black italic">{user?.coins} BC</span>
          </div>
        </div>

        <div className="w-32 h-48 rounded-3xl bg-surface-container-highest overflow-hidden flex-shrink-0 border-2 border-primary/30 flex items-center justify-center">
          {!avatarImageError && avatarPreviewUrl ? (
            <img
              src={avatarPreviewUrl}
              alt="Avatar"
              className="w-full h-full object-contain object-top"
              onError={() => setAvatarImageError(true)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-1">
              <img
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.name || 'avatar'}`}
                alt="Avatar Fallback"
                className="w-20 h-20 rounded-full"
              />
              <p className="text-[8px] text-on-surface-variant font-black uppercase tracking-widest">Avatar</p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 flex-1 pt-8">
          <h2 className="text-xl font-headline font-black text-on-surface italic uppercase tracking-tighter leading-none">{user?.name}</h2>
          <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest italic">NÍVEL {user?.level}</p>

          <div className="flex flex-col gap-1 mt-2">
            {Object.entries(user?.avatar.equipped || {})
              .filter(([slot, id]) => id && slot !== 'base_outfit')
              .map(([slot, id]) => {
                const item = (items || []).find(i => i.id === id);
                if (!item) return null;
                return (
                  <div key={slot} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    <span className="text-[9px] text-on-surface-variant font-bold uppercase tracking-widest">{item.name}</span>
                  </div>
                );
              })
            }
            {Object.values(user?.avatar.equipped || {}).filter(v => v && v !== user?.avatar.equipped?.base_outfit).length === 0 && (
              <p className="text-[9px] text-on-surface-variant opacity-40 uppercase tracking-widest italic">Nenhum item equipado</p>
            )}
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div className="flex flex-col gap-4">
        <div className="flex bg-surface-container-low p-1.5 rounded-2xl border border-outline-variant/10">
          <button onClick={() => setActiveTab('inventory')} className={cn('flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold uppercase text-[10px] tracking-widest transition-all', activeTab === 'inventory' ? 'bg-primary text-on-primary shadow-lg shadow-primary/20' : 'text-on-surface-variant hover:bg-surface-container-highest')}>
            <Package className="w-4 h-4" /> MEU ARMÁRIO
          </button>
          <button onClick={() => setActiveTab('shop')} className={cn('flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold uppercase text-[10px] tracking-widest transition-all', activeTab === 'shop' ? 'bg-secondary text-on-secondary shadow-lg shadow-secondary/20' : 'text-on-surface-variant hover:bg-surface-container-highest')}>
            <ShoppingBag className="w-4 h-4" /> LOJA
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          <button onClick={() => setSelectedSlot('all')} className={cn('px-4 py-2 rounded-full font-bold uppercase text-[8px] tracking-widest whitespace-nowrap border transition-all', selectedSlot === 'all' ? 'bg-on-surface text-surface border-on-surface' : 'bg-surface-container-low text-on-surface-variant border-outline-variant/10')}>
            TODOS
          </button>
          {Object.entries(SLOT_LABELS).map(([slot, label]) => {
            const Icon = SLOT_ICONS[slot];
            return (
              <button key={slot} onClick={() => setSelectedSlot(slot as keyof AvatarSlot)} className={cn('px-4 py-2 rounded-full font-bold uppercase text-[8px] tracking-widest whitespace-nowrap border flex items-center gap-2 transition-all', selectedSlot === slot ? 'bg-on-surface text-surface border-on-surface' : 'bg-surface-container-low text-on-surface-variant border-outline-variant/10')}>
                <Icon className="w-3 h-3" /> {label}
              </button>
            );
          })}
        </div>
      </div>

      {loading && <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>}

      {!loading && (
        <section className="grid grid-cols-2 gap-4">
          <AnimatePresence mode="wait">
            {(activeTab === 'inventory' ? inventoryItems : shopItems).map((item) => {
              const isEquipped = user?.avatar.equipped[item.slot] === item.id;
              const canAfford = (user?.coins || 0) >= item.price;
              const inInventory = user?.avatar.inventory.includes(item.id) || false;
              const imageUrl = getItemImageUrl(item.image);

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={cn(
                    'bg-surface-container-low rounded-3xl border p-4 flex flex-col gap-3 transition-all relative group cursor-pointer',
                    isEquipped ? 'border-primary bg-primary/5' : 'border-outline-variant/10 hover:border-primary/30'
                  )}
                  onClick={() => setPreviewItem(item)}
                >
                  {isEquipped && (
                    <div className="absolute top-3 right-3 bg-primary text-on-primary p-1 rounded-full shadow-lg z-10">
                      <Check className="w-3 h-3" />
                    </div>
                  )}

                  <div className="aspect-square rounded-2xl bg-surface-container-highest overflow-hidden group-hover:scale-105 transition-transform flex items-center justify-center">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={item.name}
                        className="w-full h-full object-cover object-top"
                        onError={(e) => {
                          e.currentTarget.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.name}`;
                          e.currentTarget.onerror = null;
                        }}
                      />
                    ) : (
                      <ShoppingBag className="w-8 h-8 text-on-surface-variant/30" />
                    )}
                  </div>

                  <div>
                    <h4 className="text-on-surface font-bold uppercase text-[10px] italic leading-tight">{item.name}</h4>
                    <p className="text-on-surface-variant text-[8px] font-bold uppercase tracking-widest mt-0.5 opacity-50">{SLOT_LABELS[item.slot]}</p>
                  </div>

                  {activeTab === 'inventory' ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleEquip(isEquipped ? null : item.id, item.slot); }}
                      className={cn('w-full py-2 rounded-xl font-black uppercase text-[8px] tracking-widest transition-all', isEquipped ? 'bg-surface-container-highest text-on-surface-variant' : 'bg-primary text-on-primary shadow-lg shadow-primary/20')}
                    >
                      {isEquipped ? 'REMOVER' : 'EQUIPAR'}
                    </button>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleBuy(item); }}
                      disabled={!canAfford}
                      className={cn('w-full py-2 rounded-xl font-black uppercase text-[8px] tracking-widest transition-all flex items-center justify-center gap-1.5', canAfford ? 'bg-secondary text-on-secondary shadow-lg shadow-secondary/20' : 'bg-surface-container-highest text-on-surface-variant opacity-50 cursor-not-allowed')}
                    >
                      <Coins className="w-3 h-3" /> {item.price} BC
                    </button>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>

          {activeTab === 'inventory' && inventoryItems.length === 0 && (
            <div className="col-span-2 bg-surface-container-low p-12 rounded-[2.5rem] border border-outline-variant/10 text-center">
              <Package className="w-12 h-12 text-on-surface-variant opacity-20 mx-auto mb-4" />
              <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest italic">Seu armário está vazio</p>
              <button onClick={() => setActiveTab('shop')} className="mt-4 text-primary text-[10px] font-black uppercase tracking-widest hover:underline">VISITAR A LOJA</button>
            </div>
          )}

          {activeTab === 'shop' && shopItems.length === 0 && (
            <div className="col-span-2 bg-surface-container-low p-12 rounded-[2.5rem] border border-outline-variant/10 text-center">
              <ShoppingBag className="w-12 h-12 text-on-surface-variant opacity-20 mx-auto mb-4" />
              <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest italic">Você já comprou tudo!</p>
            </div>
          )}
        </section>
      )}

      {/* Modal de preview */}
      <AnimatePresence>
        {previewItem && (
          <ItemPreviewModal
            item={previewItem}
            equipped={user?.avatar.equipped || {} as AvatarSlot}
            items={items}
            onClose={() => setPreviewItem(null)}
            onBuy={handleBuy}
            onEquip={handleEquip}
            inInventory={user?.avatar.inventory.includes(previewItem.id) || false}
            canAfford={(user?.coins || 0) >= previewItem.price}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
