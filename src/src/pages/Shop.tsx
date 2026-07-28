import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag, Search, ExternalLink, MessageCircle, Settings2,
  Plus, Edit2, Trash2, Save, X, Upload, Loader2, Star, EyeOff,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../lib/supabase';
import { uploadImage } from '../utils/image';
import {
  useShopProducts, openProduct, formatPrice, productCta, productLink,
  type ShopProduct,
} from '../components/ShopBanner';

// Categorias sugeridas — o admin pode digitar qualquer outra.
const CATEGORIAS_SUGERIDAS = ['Suplementos', 'Equipamento', 'Vestuário', 'Nutrição', 'Acessórios'];

type ProductForm = {
  id?: string;
  name: string;
  description: string;
  image_url: string;
  category: string;
  product_type: 'affiliate' | 'own';
  price: string;
  affiliate_url: string;
  contact_link: string;
  active: boolean;
  featured: boolean;
  display_order: number;
};

const FORM_VAZIO: ProductForm = {
  name: '',
  description: '',
  image_url: '',
  category: 'Suplementos',
  product_type: 'affiliate',
  price: '',
  affiliate_url: '',
  contact_link: '',
  active: true,
  featured: false,
  display_order: 0,
};

export default function Shop() {
  const { user } = useAuth();
  const toast = useToast();
  const isAdmin = user?.role === 'admin';

  const [managing, setManaging] = useState(false);
  // Admin no modo gestão enxerga também os produtos desativados.
  const { products, refetch } = useShopProducts(isAdmin && managing);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todos');
  const [form, setForm] = useState<ProductForm>(FORM_VAZIO);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const categories = useMemo(() => {
    const found = Array.from(new Set(products.map(p => p.category).filter(Boolean)));
    return ['Todos', ...found.sort()];
  }, [products]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter(p => {
      const matchCategory = category === 'Todos' || p.category === category;
      const matchTerm =
        !term ||
        p.name.toLowerCase().includes(term) ||
        (p.description || '').toLowerCase().includes(term);
      return matchCategory && matchTerm;
    });
  }, [products, search, category]);

  const featured = useMemo(
    () => visible.find(p => p.featured && p.active) || null,
    [visible]
  );
  const grid = useMemo(
    () => visible.filter(p => p.id !== featured?.id),
    [visible, featured]
  );

  // ── Ações do admin ────────────────────────────────────────────────────────

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file, 'box-assets', `shop/${Date.now()}.jpg`, 'logo');
      setForm(f => ({ ...f, image_url: url }));
    } catch (err: any) {
      toast.error('Não foi possível enviar a imagem: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Informe o nome do produto.');
      return;
    }
    if (form.product_type === 'affiliate' && !form.affiliate_url.trim()) {
      toast.error('Produto de afiliado precisa do link da oferta.');
      return;
    }
    if (form.product_type === 'own' && !form.contact_link.trim()) {
      toast.error('Produto próprio precisa do link de contato.');
      return;
    }

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      image_url: form.image_url || null,
      category: form.category.trim() || 'Geral',
      product_type: form.product_type,
      price: form.price === '' ? null : Number(form.price),
      affiliate_url: form.product_type === 'affiliate' ? form.affiliate_url.trim() : null,
      contact_link: form.product_type === 'own' ? form.contact_link.trim() : null,
      active: form.active,
      featured: form.featured,
      display_order: Number(form.display_order) || 0,
    };

    const { error } = form.id
      ? await supabase.from('shop_products').update(payload).eq('id', form.id)
      : await supabase.from('shop_products').insert(payload);

    setSaving(false);
    if (error) {
      toast.error('Erro ao salvar: ' + error.message);
      return;
    }
    toast.success(form.id ? 'Produto atualizado' : 'Produto adicionado');
    setForm(FORM_VAZIO);
    refetch();
  };

  const handleEdit = (p: ShopProduct) => {
    setForm({
      id: p.id,
      name: p.name,
      description: p.description || '',
      image_url: p.image_url || '',
      category: p.category,
      product_type: p.product_type,
      price: p.price == null ? '' : String(p.price),
      affiliate_url: p.affiliate_url || '',
      contact_link: p.contact_link || '',
      active: p.active,
      featured: p.featured,
      display_order: p.display_order,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (p: ShopProduct) => {
    if (!confirm(`Excluir "${p.name}" da loja?`)) return;
    const { error } = await supabase.from('shop_products').delete().eq('id', p.id);
    if (error) {
      toast.error('Erro ao excluir: ' + error.message);
      return;
    }
    toast.success('Produto excluído');
    if (form.id === p.id) setForm(FORM_VAZIO);
    refetch();
  };

  // ── Card de produto ───────────────────────────────────────────────────────

  const ProductCard = ({ p }: { p: ShopProduct }) => {
    const price = formatPrice(p.price);
    const disabled = !productLink(p);
    return (
      <div className="flex flex-col bg-surface-container-low rounded-3xl border border-outline-variant/10 overflow-hidden group">
        <div className="relative aspect-square bg-surface-container-highest overflow-hidden flex items-center justify-center">
          {p.image_url ? (
            <img
              src={p.image_url}
              alt={p.name}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <ShoppingBag className="w-10 h-10 text-on-surface-variant/30" />
          )}
          {!p.active && (
            <span className="absolute top-2 left-2 flex items-center gap-1 bg-background/80 text-on-surface-variant text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full">
              <EyeOff className="w-3 h-3" /> oculto
            </span>
          )}
          {isAdmin && managing && (
            <div className="absolute top-2 right-2 flex gap-1">
              <button
                onClick={() => handleEdit(p)}
                aria-label={`Editar ${p.name}`}
                className="p-2 bg-primary/20 text-primary rounded-xl hover:bg-primary hover:text-background transition-all"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDelete(p)}
                aria-label={`Excluir ${p.name}`}
                className="p-2 bg-error-container text-on-error-container rounded-xl hover:bg-error hover:text-white transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        <div className="p-4 flex flex-col flex-1 gap-1">
          <p className="text-[8px] font-black text-on-surface-variant uppercase tracking-widest">
            {p.category}
          </p>
          <h3 className="text-xs font-bold text-on-surface uppercase italic leading-tight line-clamp-2">
            {p.name}
          </h3>
          {price && (
            <p className="text-lg font-headline font-black text-primary leading-none mt-1">{price}</p>
          )}
          <button
            onClick={() => openProduct(p)}
            disabled={disabled}
            className={cn(
              'mt-3 w-full h-10 rounded-2xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all',
              disabled
                ? 'bg-surface-container-highest text-on-surface-variant opacity-50 cursor-not-allowed'
                : 'bg-primary text-background active:scale-95 hover:shadow-[0_6px_20px_rgba(202,253,0,0.2)]'
            )}
          >
            {productCta(p)}
            {p.product_type === 'affiliate'
              ? <ExternalLink className="w-3.5 h-3.5" />
              : <MessageCircle className="w-3.5 h-3.5" />}
          </button>
          {isAdmin && managing && (
            <p className="text-[8px] text-on-surface-variant uppercase tracking-widest mt-2 opacity-60">
              {p.click_count} cliques · ordem {p.display_order}
            </p>
          )}
        </div>
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 p-4 pt-8">
      <header className="flex justify-between items-center">
        <h1 className="text-3xl font-headline font-black text-on-surface tracking-tight uppercase italic flex items-center gap-3">
          <ShoppingBag className="w-8 h-8 text-primary" />
          LOJA
        </h1>
        {isAdmin && (
          <button
            onClick={() => { setManaging(m => !m); setForm(FORM_VAZIO); }}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-full border text-[9px] font-black uppercase tracking-widest transition-all',
              managing
                ? 'bg-primary text-background border-primary'
                : 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20'
            )}
          >
            <Settings2 className="w-3.5 h-3.5" />
            {managing ? 'Sair da gestão' : 'Gerenciar'}
          </button>
        )}
      </header>

      {/* ── Formulário do admin ── */}
      <AnimatePresence>
        {isAdmin && managing && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-surface-container-low p-6 rounded-[2rem] border border-outline-variant/10 space-y-4"
          >
            <h2 className="font-headline font-bold text-lg text-on-surface uppercase italic flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              {form.id ? 'EDITAR PRODUTO' : 'NOVO PRODUTO'}
            </h2>

            <div className="space-y-2">
              <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Nome</label>
              <input
                type="text" value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="ex: Whey Isolado 900g"
                className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Descrição (opcional)</label>
              <textarea
                value={form.description} rows={2}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Aparece na busca da loja"
                className="w-full bg-surface-container-highest border-none rounded-2xl p-4 text-sm text-on-surface resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Tipo</label>
                <select
                  value={form.product_type}
                  onChange={e => setForm({ ...form, product_type: e.target.value as 'affiliate' | 'own' })}
                  className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface appearance-none cursor-pointer"
                >
                  <option value="affiliate">Link de afiliado</option>
                  <option value="own">Produto próprio</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Categoria</label>
                <input
                  type="text" list="shop-categorias" value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                  className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface"
                />
                <datalist id="shop-categorias">
                  {CATEGORIAS_SUGERIDAS.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">
                {form.product_type === 'affiliate' ? 'Link de afiliado' : 'Link de contato (WhatsApp/Instagram)'}
              </label>
              <input
                type="url"
                value={form.product_type === 'affiliate' ? form.affiliate_url : form.contact_link}
                onChange={e => setForm(
                  form.product_type === 'affiliate'
                    ? { ...form, affiliate_url: e.target.value }
                    : { ...form, contact_link: e.target.value }
                )}
                placeholder={form.product_type === 'affiliate' ? 'https://...' : 'https://wa.me/55...'}
                className="w-full bg-surface-container-highest border-none rounded-2xl p-4 text-sm text-on-surface"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Preço em R$ (opcional)</label>
                <input
                  type="number" step="0.01" min="0" value={form.price}
                  onChange={e => setForm({ ...form, price: e.target.value })}
                  placeholder="149.90"
                  className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Ordem de exibição</label>
                <input
                  type="number" value={form.display_order}
                  onChange={e => setForm({ ...form, display_order: Number(e.target.value) })}
                  className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Imagem</label>
              <div className="flex gap-3 items-center">
                {form.image_url && (
                  <img src={form.image_url} alt="Prévia do produto" className="w-14 h-14 rounded-2xl object-cover bg-surface-container-highest shrink-0" />
                )}
                <label className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border border-outline-variant/10 bg-surface-container-highest text-on-surface-variant text-[9px] font-bold uppercase tracking-widest cursor-pointer hover:border-primary/40 hover:text-primary transition-all">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploading ? 'Enviando...' : 'Selecionar imagem'}
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={uploading} onChange={handleUpload} />
                </label>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setForm({ ...form, active: !form.active })}
                className={cn(
                  'flex-1 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest border transition-all',
                  form.active
                    ? 'bg-primary/10 text-primary border-primary/30'
                    : 'bg-surface-container-highest text-on-surface-variant border-outline-variant/10'
                )}
              >
                {form.active ? 'Visível na loja' : 'Oculto'}
              </button>
              <button
                onClick={() => setForm({ ...form, featured: !form.featured })}
                className={cn(
                  'flex-1 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest border transition-all flex items-center justify-center gap-1.5',
                  form.featured
                    ? 'bg-secondary/10 text-secondary border-secondary/30'
                    : 'bg-surface-container-highest text-on-surface-variant border-outline-variant/10'
                )}
              >
                <Star className={cn('w-3.5 h-3.5', form.featured && 'fill-current')} />
                Destaque
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSave} disabled={saving}
                className="flex-1 bg-primary text-background py-4 rounded-2xl font-headline font-black uppercase italic shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                {form.id ? 'Salvar alterações' : 'Adicionar produto'}
              </button>
              {form.id && (
                <button
                  onClick={() => setForm(FORM_VAZIO)}
                  className="flex-1 bg-surface-container-highest text-on-surface py-4 rounded-2xl font-headline font-black uppercase italic flex items-center justify-center gap-2"
                >
                  <X className="w-5 h-5" /> Cancelar
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Busca ── */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" />
        <input
          type="text" value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="BUSCAR PRODUTO..."
          aria-label="Buscar produto"
          className="w-full h-14 pl-11 pr-4 bg-surface-container-low border border-outline-variant/10 rounded-2xl text-xs font-bold uppercase tracking-widest text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary/40 transition-colors"
        />
      </div>

      {/* ── Categorias ── */}
      {categories.length > 1 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn(
                'shrink-0 px-5 py-2 rounded-full text-[9px] font-black uppercase tracking-widest transition-all',
                category === c
                  ? 'bg-primary text-background'
                  : 'bg-surface-container-highest text-on-surface-variant hover:text-on-surface'
              )}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {/* ── Destaque ── */}
      {featured && (
        <section
          onClick={() => openProduct(featured)}
          className="relative rounded-[2rem] overflow-hidden border border-outline-variant/10 cursor-pointer active:scale-[0.99] transition-transform"
        >
          <div className="aspect-[16/10] bg-surface-container-highest flex items-center justify-center">
            {featured.image_url ? (
              <img src={featured.image_url} alt={featured.name} className="w-full h-full object-cover" />
            ) : (
              <ShoppingBag className="w-12 h-12 text-on-surface-variant/30" />
            )}
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          <div className="absolute bottom-0 left-0 w-full p-5">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-1.5 h-1.5 bg-secondary rounded-full animate-pulse" />
              <span className="text-[9px] font-black text-secondary uppercase tracking-widest">Destaque</span>
            </div>
            <h2 className="text-xl font-headline font-black text-on-surface uppercase italic leading-tight">
              {featured.name}
            </h2>
            <div className="mt-3 flex items-end justify-between gap-3">
              {formatPrice(featured.price) && (
                <p className="text-2xl font-headline font-black text-primary leading-none">
                  {formatPrice(featured.price)}
                </p>
              )}
              <span className="ml-auto px-5 h-11 bg-primary text-background rounded-2xl text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5">
                {productCta(featured)}
                {featured.product_type === 'affiliate'
                  ? <ExternalLink className="w-3.5 h-3.5" />
                  : <MessageCircle className="w-3.5 h-3.5" />}
              </span>
            </div>
          </div>
        </section>
      )}

      {/* ── Grade ── */}
      {grid.length > 0 ? (
        <div className="grid grid-cols-2 gap-4">
          {grid.map(p => <ProductCard key={p.id} p={p} />)}
        </div>
      ) : (
        !featured && (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <div className="w-16 h-16 bg-surface-container-low rounded-3xl border border-outline-variant/10 flex items-center justify-center">
              <ShoppingBag className="w-8 h-8 text-on-surface-variant/40" />
            </div>
            <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest max-w-[220px] leading-relaxed">
              {search || category !== 'Todos'
                ? 'Nenhum produto encontrado com esse filtro'
                : isAdmin
                  ? 'A loja está vazia. Toque em Gerenciar para adicionar o primeiro produto.'
                  : 'A loja ainda não tem produtos. Volte em breve.'}
            </p>
          </div>
        )
      )}
    </div>
  );
}
