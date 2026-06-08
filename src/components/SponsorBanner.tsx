import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';

export interface Sponsor {
  id: string;
  name: string;
  logo_url?: string | null;
  description?: string | null;
  display_duration: number; // segundos
  show_on_tv: boolean;
  show_on_app: boolean;
  active: boolean;
  order_index: number;
}

// ─── Banner na TV (área do header) ─────────────────────────────────────────
interface TVSponsorBannerProps {
  sponsors: Sponsor[];
  className?: string;
}

export function TVSponsorBanner({ sponsors, className = '' }: TVSponsorBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const tvSponsors = sponsors.filter(s => s.show_on_tv && s.active);

  useEffect(() => {
    if (tvSponsors.length <= 1) return;
    const current = tvSponsors[currentIndex];
    const duration = (current?.display_duration || 8) * 1000;
    const timer = setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % tvSponsors.length);
    }, duration);
    return () => clearTimeout(timer);
  }, [currentIndex, tvSponsors]);

  if (tvSponsors.length === 0) return null;

  const sponsor = tvSponsors[currentIndex % tvSponsors.length];

  return (
    <div className={`relative flex flex-col items-center justify-center overflow-hidden rounded-2xl bg-white/5 border border-white/10 min-w-[220px] max-w-[320px] px-4 py-2 ${className}`}>
      {/* Label */}
      <span className="text-white/20 text-[8px] font-black uppercase tracking-[0.3em] absolute top-1.5 left-3">
        PATROCINADOR
      </span>

      <AnimatePresence mode="wait">
        <motion.div
          key={sponsor.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center justify-center gap-1 mt-3"
        >
          {sponsor.logo_url ? (
            <img
              src={sponsor.logo_url}
              alt={sponsor.name}
              className="max-h-12 max-w-[200px] object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <p className="text-white font-headline font-black text-xl italic uppercase tracking-tight">
              {sponsor.name}
            </p>
          )}
          {sponsor.description && (
            <p className="text-white/50 text-[9px] font-black uppercase tracking-widest text-center leading-tight">
              {sponsor.description}
            </p>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Dots de progresso */}
      {tvSponsors.length > 1 && (
        <div className="flex gap-1 mt-2">
          {tvSponsors.map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-300 ${
                i === currentIndex % tvSponsors.length
                  ? 'w-3 h-1 bg-primary'
                  : 'w-1 h-1 bg-white/20'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Banner no App (mobile) ─────────────────────────────────────────────────
interface AppSponsorBannerProps {
  sponsors: Sponsor[];
  className?: string;
}

export function AppSponsorBanner({ sponsors, className = '' }: AppSponsorBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const appSponsors = sponsors.filter(s => s.show_on_app && s.active);

  useEffect(() => {
    if (appSponsors.length <= 1) return;
    const current = appSponsors[currentIndex];
    const duration = (current?.display_duration || 8) * 1000;
    const timer = setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % appSponsors.length);
    }, duration);
    return () => clearTimeout(timer);
  }, [currentIndex, appSponsors]);

  if (appSponsors.length === 0) return null;

  const sponsor = appSponsors[currentIndex % appSponsors.length];

  return (
    <div className={`rounded-2xl bg-surface-container border border-outline-variant/20 overflow-hidden ${className}`}>
      <div className="px-3 py-1 border-b border-outline-variant/10">
        <span className="text-on-surface-variant text-[9px] font-black uppercase tracking-[0.3em]">
          PATROCINADOR
        </span>
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={sponsor.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-3 px-4 py-3"
        >
          {sponsor.logo_url ? (
            <img
              src={sponsor.logo_url}
              alt={sponsor.name}
              className="h-10 max-w-[120px] object-contain rounded-lg"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="bg-primary/10 border border-primary/20 rounded-xl px-3 py-2">
              <p className="text-primary font-headline font-black text-sm italic uppercase">
                {sponsor.name}
              </p>
            </div>
          )}
          {sponsor.description && (
            <p className="text-on-surface-variant text-xs font-medium flex-1 leading-snug">
              {sponsor.description}
            </p>
          )}
        </motion.div>
      </AnimatePresence>

      {appSponsors.length > 1 && (
        <div className="flex gap-1 px-4 pb-2">
          {appSponsors.map((_, i) => (
            <div
              key={i}
              className={`rounded-full h-1 transition-all duration-300 ${
                i === currentIndex % appSponsors.length
                  ? 'w-4 bg-primary'
                  : 'w-1 bg-on-surface-variant/20'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Hook para buscar patrocinadores ───────────────────────────────────────
export function useSponsors() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);

  const fetchSponsors = useCallback(async () => {
    const { data } = await supabase
      .from('sponsors')
      .select('*')
      .eq('active', true)
      .order('order_index', { ascending: true });
    setSponsors(data || []);
  }, []);

  useEffect(() => {
    fetchSponsors();
    const channel = supabase
      .channel('sponsors-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sponsors' }, fetchSponsors)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchSponsors]);

  return sponsors;
}
