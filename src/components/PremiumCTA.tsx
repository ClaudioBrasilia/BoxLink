import { useState, useEffect } from 'react';
import { Sparkles, Copy } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../context/ToastContext';

interface PremiumInfo {
  price_cents: number;
  contact: string;
}

// Conversão para Premium ainda é manual (fale com o admin) — quando existir
// um pagamento automático, só troca o onClick do botão pelo checkout.
export default function PremiumCTA() {
  const toast = useToast();
  const [info, setInfo] = useState<PremiumInfo | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    supabase.from('box_settings').select('premium_info').maybeSingle().then(({ data }) => {
      if (data?.premium_info) setInfo(data.premium_info as PremiumInfo);
    });
  }, []);

  const priceLabel = info
    ? (info.price_cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : null;

  const handleCopyContact = async () => {
    if (!info?.contact) return;
    try {
      await navigator.clipboard.writeText(info.contact);
      toast.success('Contato copiado!');
    } catch {
      toast.warning(info.contact);
    }
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full bg-secondary text-background py-3 rounded-2xl font-headline font-black text-xs uppercase italic flex items-center justify-center gap-2 hover:opacity-90 transition-all"
      >
        <Sparkles className="w-4 h-4" /> Quero ser Premium
      </button>
      {expanded && (
        <div className="bg-secondary/5 border border-secondary/20 rounded-2xl p-4 flex flex-col gap-2">
          {priceLabel && (
            <p className="text-sm font-black text-on-surface">
              {priceLabel}<span className="text-[10px] text-on-surface-variant font-bold"> /mês</span>
            </p>
          )}
          <p className="text-[11px] text-on-surface-variant font-medium leading-relaxed">
            Ainda não temos pagamento automático — fale com o admin do box para ativar.
          </p>
          {info?.contact ? (
            <button
              onClick={handleCopyContact}
              className="flex items-center justify-between gap-2 bg-surface-container-highest rounded-xl px-3 py-2.5 hover:bg-surface-container transition-all"
            >
              <span className="text-xs font-bold text-on-surface truncate">{info.contact}</span>
              <Copy className="w-3.5 h-3.5 text-on-surface-variant flex-shrink-0" />
            </button>
          ) : (
            <p className="text-[10px] text-on-surface-variant/60 font-bold uppercase tracking-widest">
              Contato não configurado
            </p>
          )}
        </div>
      )}
    </div>
  );
}
