function TVHeartRatePanel() {
  const [athletesMap, setAthletesMap] = useState<Record<string, AthleteHR>>({});

  useEffect(() => {
    // 1. Cria e escuta o canal rápido de batimentos cardíacos
    const channel = supabase.channel('boxlink-live-hr');

    channel
      .on('broadcast', { event: 'pulse' }, async (payload) => {
        const { user_id, bpm } = payload.payload;
        if (!user_id) return;

        // Verifica se já temos o nome desse atleta salvo para evitar buscar no banco toda hora
        setAthletesMap((prev) => {
          const existingAthlete = prev[user_id];
          
          // Se o atleta acabou de entrar e não tem nome, busca o perfil dele
          if (!existingAthlete) {
            supabase
              .from('profiles')
              .select('name')
              .eq('id', user_id)
              .single()
              .then(({ data }) => {
                if (data?.name) {
                  setAthletesMap((current) => ({
                    ...current,
                    [user_id]: {
                      ...current[user_id],
                      name: data.name
                    }
                  }));
                }
              });
          }

          return {
            ...prev,
            [user_id]: {
              user_id,
              bpm,
              updated_at: new Date().toISOString(),
              name: existingAthlete?.name || 'Atleta'
            }
          };
        });
      })
      .subscribe();

    // 2. Sistema de limpeza (Timeout): Varre o estado a cada 4 segundos e remove quem ficou offline
    const cleanupInterval = setInterval(() => {
      setAthletesMap((prev) => {
        const freshMap = { ...prev };
        const now = Date.now();
        let changed = false;

        Object.keys(freshMap).forEach((id) => {
          const lastSeen = new Date(freshMap[id].updated_at).getTime();
          // Se o aluno não mandar sinal por mais de 15 segundos, sai da tela da TV
          if (now - lastSeen > 15000) {
            delete freshMap[id];
            changed = true;
          }
        });

        return changed ? freshMap : prev;
      });
    }, 4000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(cleanupInterval);
    };
  }, []);

  // Transforma o objeto em array ordenado pelo maior BPM para renderizar no seu layout
  const athletes = Object.values(athletesMap).sort((a, b) => b.bpm - a.bpm);

  if (athletes.length === 0) return null;

  return (
    <section className="bg-[#111] rounded-[2.5rem] border border-white/5 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Heart className="w-4 h-4 text-red-400 animate-pulse" />
          <h3 className="text-sm font-headline font-black text-white italic uppercase tracking-tight">FC AO VIVO</h3>
        </div>
        <span className="bg-red-500/20 border border-red-500/30 text-red-400 px-2 py-0.5 rounded-full font-headline font-black text-[10px] italic">
          {athletes.length} relógio{athletes.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <AnimatePresence>
          {athletes.map((athlete) => {
            const zone = getHRZone(athlete.bpm);
            const pct = Math.min(100, Math.max(0, ((athlete.bpm - 50) / 150) * 100));
            const firstName = athlete.name?.split(' ')[0] || 'Atleta';

            return (
              <motion.div
                key={athlete.user_id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col gap-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center font-headline font-black text-xs shrink-0"
                      style={{
                        backgroundColor: zone.color + '20',
                        border: `1px solid ${zone.color}40`,
                        color: zone.color
                      }}
                    >
                      {firstName[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-black text-[10px] uppercase italic truncate leading-none">
                        {firstName}
                      </p>
                      <p className="text-[8px] font-black uppercase tracking-wider mt-0.5" style={{ color: zone.color }}>
                        {zone.label}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-baseline gap-0.5 shrink-0">
                    <motion.span
                      key={athlete.bpm}
                      initial={{ scale: 1.3, opacity: 0.5 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="font-headline font-black text-xl italic tabular-nums"
                      style={{ color: zone.color, textShadow: `0 0 16px ${zone.glow}` }}
                    >
                      {athlete.bpm}
                    </motion.span>
                    <span className="text-[8px] font-black uppercase" style={{ color: zone.color }}>
                      BPM
                    </span>
                  </div>
                </div>

                <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${zone.bar}`}
                    style={{ boxShadow: `0 0 6px ${zone.glow}` }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </section>
  );
}
