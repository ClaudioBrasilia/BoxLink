import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';

// ─── Tipo do produto da loja ────────────────────────────────────────────────
export interface ShopProduct {
  id: string;
  name: string;
  description?: string | null;
  image_url?: string | null;
  category: string;
  product_type: 'affiliate' | 'own';
  price?: number | null;
  affiliate_url?: string | null;
  contact_link?: string | null;
  active: boolean;
  featured: boolean;
  display_order: number;
  click_count: number;
}

// ─── Helpers compartilhados ─────────────────────────────────────────────────

/** Formata o preço em Real. Retorna null quando o produto não tem preço. */
export const formatPrice = (price?: number | null): string | null => {
  if (price == null) return null;
  return Number(price).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });
};

/** Link de destino: afiliado abre a oferta, produto próprio abre o contato. */
export const productLink = (p: ShopProduct): string | null =>
  (p.product_type === 'affiliate' ? p.affiliate_url : p.contact_link) || null;

/** Texto do botão conforme o tipo do produto. */
export const productCta = (p: ShopProduct): string =>
  p.product_type === 'affiliate' ? 'Ver oferta' : 'Falar no WhatsApp';

/**
 * Abre o link do produto em uma nova aba e registra o clique.
 * A janela abre primeiro (síncrono) para não ser bloqueada pelo navegador;
 * a contagem é best-effort e nunca trava a navegação do atleta.
 */
export const openProduct = (p: ShopProduct): void => {
  const url = productLink(p);
  if (!url) return;
  window.open(url, '_blank', 'noopener,noreferrer');
  supabase
    .rpc('increment_shop_click', { product_id: p.id })
    .then(({ error }) => {
      if (error) console.warn('[shop] clique não registrado:', error.message);
    });
};

// ─── Hook de produtos ───────────────────────────────────────────────────────

/**
 * Busca os produtos da loja com atualização em tempo real.
 * @param includeInactive true apenas no painel do admin (a RLS permite).
 */
export function useShopProducts(includeInactive = false) {
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = useCallback(async () => {
    let query = supabase
      .from('shop_products')
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (!includeInactive) query = query.eq('active', true);

    const { data, error } = await query;
    if (error) console.warn('[shop] erro ao carregar produtos:', error.message);
    setProducts((data as ShopProduct[]) || []);
    setLoading(false);
  }, [includeInactive]);

  useEffect(() => {
    fetchProducts();
    const channel = supabase
      .channel('shop-products-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_products' }, fetchProducts)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchProducts]);

  return { products, loading, refetch: fetchProducts };
}

// ─── Card da loja no Dashboard ──────────────────────────────────────────────

interface ShopBannerProps {
  className?: string;
}

/**
 * Card estreito que fica ao lado do banner de patrocinadores.
 * Mostra um único produto — o marcado como destaque, ou o primeiro da ordem.
 * Toque abre a oferta direto. Some quando a loja está vazia (exceto p/ admin).
 */
export default function ShopBanner({ className = '' }: ShopBannerProps) {
  const { products, loading } = useShopProducts();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  // Enquanto carrega, não pisca nada na tela.
  if (loading) return null;

  // Loja vazia: o atleta não vê nada; o admin vê o atalho para cadastrar.
  if (products.length === 0) {
    if (!isAdmin) return null;
    return (
      <button
        onClick={() => navigate('/shop')}
        aria-label="Cadastrar o primeiro produto da loja"
        className={cn(
          'w-[104px] shrink-0 rounded-2xl border border-dashed border-primary/30',
          'bg-surface-container-low flex flex-col items-center justify-center gap-1.5 py-5',
          'hover:border-primary/60 transition-all',
          className
        )}
      >
        <Plus className="w-5 h-5 text-primary" />
        <span className="text-[8px] font-black text-on-surface-variant uppercase tracking-widest text-center leading-tight px-2">
          Loja vazia
        </span>
      </button>
    );
  }

  // Um produto só: o destaque, ou o primeiro da ordem de exibição.
  const product = products.find(p => p.featured) || products[0];
  const price = formatPrice(product.price);

  return (
    <button
      onClick={() => openProduct(product)}
      aria-label={`${productCta(product)}: ${product.name}`}
      className={cn(
        'w-[104px] shrink-0 rounded-2xl overflow-hidden bg-surface-container-low',
        'border border-outline-variant/20 text-left group',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        'active:scale-[0.97] transition-transform',
        className
      )}
    >
      <div className="relative h-[68px] bg-surface-container-highest flex items-center justify-center overflow-hidden">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <ShoppingBag className="w-6 h-6 text-on-surface-variant/30" />
        )}
        <span className="absolute top-1.5 left-1.5 bg-background/75 backdrop-blur-sm text-primary text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full">
          Loja
        </span>
      </div>

      <div className="px-2 py-2">
        <p className="text-[8px] font-bold text-on-surface uppercase italic leading-tight line-clamp-2">
          {product.name}
        </p>
        {price && (
          <p className="text-[10px] font-headline font-black text-primary leading-none mt-1">
            {price}
          </p>
        )}
      </div>
    </button>
  );
}
