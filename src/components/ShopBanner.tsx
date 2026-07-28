import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';

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

// ─── Banner do Dashboard ────────────────────────────────────────────────────

interface ShopBannerProps {
  className?: string;
}

/**
 * Vitrine compacta no Dashboard: mostra os destaques em um scroller
 * horizontal e leva para a loja completa. Some quando não há produtos.
 */
export default function ShopBanner({ className = '' }: ShopBannerProps) {
  const { products } = useShopProducts();
  const navigate = useNavigate();

  if (products.length === 0) return null;

  // Destaques primeiro, depois o restante — no máximo 6 no banner.
  const showcase = [...products]
    .sort((a, b) => Number(b.featured) - Number(a.featured))
    .slice(0, 6);

  return (
    <section
      className={`bg-surface-container-low rounded-3xl border border-outline-variant/10 p-4 ${className}`}
    >
      <div
        onClick={() => navigate('/shop')}
        className="flex items-center justify-between mb-3 cursor-pointer group"
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-primary/20 rounded-xl flex items-center justify-center">
            <ShoppingBag className="w-4 h-4 text-primary" />
          </div>
          <h3 className="text-[10px] font-black text-on-surface uppercase tracking-widest italic">
            LOJA
          </h3>
        </div>
        <div className="flex items-center gap-1 text-on-surface-variant group-hover:text-primary transition-colors">
          <span className="text-[9px] font-black uppercase tracking-widest">VER TUDO</span>
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
        {showcase.map((p) => {
          const price = formatPrice(p.price);
          return (
            <button
              key={p.id}
              onClick={() => openProduct(p)}
              className="shrink-0 w-28 text-left group/item focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl"
            >
              <div className="w-28 h-28 rounded-2xl bg-surface-container-highest overflow-hidden flex items-center justify-center border border-outline-variant/10">
                {p.image_url ? (
                  <img
                    src={p.image_url}
                    alt={p.name}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover/item:scale-105 transition-transform duration-500"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <ShoppingBag className="w-7 h-7 text-on-surface-variant/30" />
                )}
              </div>
              <p className="mt-2 text-[10px] font-bold text-on-surface uppercase italic leading-tight line-clamp-2">
                {p.name}
              </p>
              {price && (
                <p className="text-[10px] font-black text-primary mt-0.5">{price}</p>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
