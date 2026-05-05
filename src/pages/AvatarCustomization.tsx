import { useState, useEffect, useRef } from 'react';
import { ShoppingBag, Package, Check, Coins, ChevronLeft, Sparkles, Shirt, Footprints, Glasses, GraduationCap, Watch, Loader2, SlidersHorizontal, X, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Item, AvatarSlot } from '../types';
import AvatarPreview from '../components/AvatarPreview';
import { supabase } from '../lib/supabase';
import { LayerAdjustment, SLOT_DEFAULTS, resolveAdjustment, adjustmentToCSS } from '../lib/avatarLayers';
import type { AvatarSlotKey } from '../lib/avatarLayers';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const BUCKET = 'avatar-assets';

function getItemImageUrl(imageKey: string): string {
  if (!imageKey) return '';
  if (imageKey.startsWith('http')) return imageKey;
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${encodeURIComponent(imageKey)}.png`;
}

// Retorna a URL direta da imagem do item — usa o campo image se for URL completa,
// senão monta pelo ID no bucket
function getItemPreviewUrl(item: Item): string {
  if (item.image?.startsWith('http')) return item.image;
  const key = item.image || item.id;
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${encodeURIComponent(key)}.png`;
}

const SLOT_ICONS: Record<string, any> = {
  top: Shirt, bottom: Footprints, shoes: Footprints,
  accessory: Glasses, head_accessory: GraduationCap, wrist_accessory: Watch, special: Sparkles,
};

const SLOT_LABELS: Record<string, string> = {
  top: 'Camiseta', bottom: 'Calça/Short', shoes: 'Tênis',
  accessory: 'Acessório', head_accessory: 'Cabeça', wrist_accessory: 'Pulso', special: 'Especial',
};

// ─── Calibrador inline (só visível para admin) ───────────────────────────────

function SliderRow({ label, value, min, max, step, onChange, fmt }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; fmt?: (v: number) => string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between">
        <span className="text-[8px] font-bold uppercase tracking-widest text-on-surface-variant">{label}</span>
        <span className="text-[8px] font-black text-primary font-mono">
          {fmt ? fmt(value) : value.toFixed(1)}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-1 rounded-full accent-primary cursor-pointer"
      />
    </div>
  );
}

interface CalibratorPanelProps {
  item: Item;
  onSave: (itemId: string, adj: Partial<LayerAdjustment>) => Promise<void>;
  onClose: () => void;
}

function CalibratorPanel({ item, onSave, onClose }: CalibratorPanelProps) {
  const slot = item.slot as AvatarSlotKey;
  const [adj, setAdj] = useState<LayerAdjustment>(resolveAdjustment(slot, item.layer_adjustment));
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof LayerAdjustment>(k: K, v: LayerAdjustment[K]) =>
    setAdj(prev => ({ ...prev, [k]: v }));

  const getDiff = (): Partial<LayerAdjustment> => {
    const def = SLOT_DEFAULTS[slot];
    const diff: Partial<LayerAdjustment> = {};
    for (const k of Object.keys(adj) as (keyof LayerAdjustment)[]) {
      if (adj[k] !== (def as any)[k]) (diff as any)[k] = adj[k];
    }
    return diff;
  };

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(item.id, getDiff()); } finally { setSaving(false); }
  };

  const baseStyle: React.CSSProperties = {
    position: 'absolute', inset: 0, width: '100%', height: '100%',
    objectFit: 'cover', objectPosition: 'top center', zIndex: 0,
  };

  // URL correta da imagem do item
  const itemImageUrl = getItemPreviewUrl(item);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
      className="fixed inset-x-0 bottom-0 z-50 bg-surface-container-low border-t border-outline-variant/20 rounded-t-3xl p-5 flex flex-col gap-4 shadow-2xl"
      style={{ maxHeight: '80vh', overflowY: 'auto' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[7px] font-bold uppercase tracking-widest text-on-surface-variant opacity-50">🎯 Calibrando camada</p>
          <h4 className="text-sm font-headline font-black text-on-surface uppercase italic">{item.name}</h4>
        </div>
        <button onClick={onClose} className="p-2 rounded-xl bg-surface-container-highest text-on-surface-variant hover:text-on-surface transition-all">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Preview masculino + feminino lado a lado */}
      <div className="flex gap-3">
        {(['base masculina', 'base feminina'] as const).map(base => (
          <div key={base} className="flex-1 flex flex-col items-center gap-1">
            <div className="relative w-full rounded-2xl overflow-hidden bg-surface-container-highest border border-outline-variant/10" style={{ paddingBottom: '150%' }}>
              <img
                src={getItemImageUrl(base)}
                alt="base"
                style={baseStyle}
                onError={e => { e.currentTarget.style.display = 'none'; }}
              />
              <img
                src={itemImageUrl}
                alt={item.name}
                style={{ ...adjustmentToCSS(adj), position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                onError={e => { e.currentTarget.style.opacity = '0.15'; }}
              />
            </div>
            <span className="text-[7px] font-bold uppercase tracking-widest text-on-surface-variant opacity-40">
              {base === 'base masculina' ? '♂' : '♀'}
            </span>
          </div>
        ))}
      </div>

      {/* Sliders */}
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <SliderRow label="Escala X" value={adj.scaleX} min={0.5} max={2} step={0.01} onChange={v => set('scaleX', v)} fmt={v => `${(v*100).toFixed(0)}%`} />
          <SliderRow label="Escala Y" value={adj.scaleY} min={0.5} max={2} step={0.01} onChange={v => set('scaleY', v)} fmt={v => `${(v*100).toFixed(0)}%`} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SliderRow label="Offset X" value={adj.offsetX} min={-50} max={50} step={0.5} onChange={v => set('offsetX', v)} fmt={v => `${v}%`} />
          <SliderRow label="Offset Y" value={adj.offsetY} min={-50} max={50} step={0.5} onChange={v => set('offsetY', v)} fmt={v => `${v}%`} />
        </div>

        {/* Ancoragem */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[8px] font-bold uppercase tracking-widest text-on-surface-variant">Ancoragem</span>
          <div className="grid grid-cols-3 gap-1.5">
            {['top center', 'center center', 'bottom center'].map(pos => (
              <button key={pos} onClick={() => set('objectPosition', pos)}
                className={cn('py-1.5 rounded-xl text-[7px] font-bold uppercase tracking-widest border transition-all',
                  adj.objectPosition === pos ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container-highest text-on-surface-variant border-outline-variant/10')}>
                {pos === 'top center' ? 'Topo' : pos === 'center center' ? 'Centro' : 'Base'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button onClick={() => setAdj(resolveAdjustment(slot, null))}
          className="px-4 py-2.5 rounded-xl bg-surface-container-highest text-on-surface-variant text-[8px] font-bold uppercase tracking-widest border border-outline-variant/10 transition-all">
          Resetar
        </button>
        <button onClick={handleSave} disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-on-primary text-[9px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 disabled:opacity-50 transition-all">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          {saving ? 'Salvando...' : 'Salvar Ajuste'}
        </button>
      </div>
    </motion.div>
  );
}

// ─── Upload padronizado ────────────────────────────────────────────────────────

async function uploadAvatarItem(
  file: File,
  itemId: string,
  slot: AvatarSlotKey
): Promise<{ publicUrl: string; naturalWidth: number; naturalHeight: number }> {
  const TARGET = { w: 512, h: 768 };
  const { w: targetW, h: targetH } = TARGET;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async (ev) => {
      const img = new Image();
      img.src = ev.target?.result as string;
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d')!;
        const scale = Math.min(targetW / img.width, targetH / img.height);
        const dx = (targetW - img.width * scale) / 2;
        const dy = (targetH - img.height * scale) / 2;
        ctx.drawImage(img, dx, dy, img.width * scale, img.height * scale);

        canvas.toBlob(async (blob) => {
          if (!blob) { reject(new Error('Falha ao processar imagem')); return; }
          const filename = `${itemId}.png`;
          const { data, error } = await supabase.storage
            .from(BUCKET)
            .upload(filename, blob, { upsert: true, contentType: 'image/png' });
          if (error) { reject(error); return; }
          const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
          resolve({ publicUrl, naturalWidth: img.width, naturalHeight: img.height });
        }, 'image/png');
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
}

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
  const [calibratingItem, setCalibratingItem] = useState<Item | null>(null);

  const isAdmin = user?.role === 'admin';

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

  const handleSaveLayerAdjustment = async (itemId: string, adjustment: Partial<LayerAdjustment>) => {
    const { error } = await supabase.from('items').update({ layer_adjustment: adjustment }).eq('id', itemId);
    if (error) { showToast('Erro ao salvar ajuste.', 'error'); return; }
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, layer_adjustment: adjustment as any } : i));
    setCalibratingItem(null);
    showToast('Ajuste salvo!');
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
            const hasCalibration = !!item.layer_adjustment;

            return (
              <motion.div key={item.id} layout initial={{ opacity:0, scale:0.9 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0, scale:0.9 }}
                className={cn('bg-surface-container-low rounded-3xl border p-4 flex flex-col gap-3 transition-all relative group',
                  isEquipped ? 'border-primary bg-primary/5' : 'border-outline-variant/10 hover:border-primary/30')}>

                {isEquipped && (
                  <div className="absolute top-3 right-3 bg-primary text-on-primary p-1 rounded-full shadow-lg">
                    <Check className="w-3 h-3" />
                  </div>
                )}

                {isAdmin && (
                  <button
                    onClick={() => setCalibratingItem(calibratingItem?.id === item.id ? null : item)}
                    className={cn(
                      'absolute top-3 left-3 p-1.5 rounded-full transition-all z-10',
                      calibratingItem?.id === item.id
                        ? 'bg-primary text-on-primary'
                        : hasCalibration
                          ? 'bg-primary/20 text-primary hover:bg-primary hover:text-on-primary'
                          : 'bg-surface-container-highest text-on-surface-variant hover:bg-primary hover:text-on-primary'
                    )}
                    title="Calibrar camada"
                  >
                    <SlidersHorizontal className="w-3 h-3" />
                  </button>
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
                    {hasCalibration && <span className="ml-1 text-primary">• ajustado</span>}
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

      {/* Painel de calibração (admin, bottom sheet) */}
      <AnimatePresence>
        {calibratingItem && isAdmin && (
          <>
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
              onClick={() => setCalibratingItem(null)} />
            <CalibratorPanel
              item={calibratingItem}
              onSave={handleSaveLayerAdjustment}
              onClose={() => setCalibratingItem(null)}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  );
      }
