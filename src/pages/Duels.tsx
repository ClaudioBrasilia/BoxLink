// (Importações e Helpers permanecem similares, mas com suporte a opponentIds lista)

// Dentro do componente Duels:
  const handleCreateDuel = async () => {
    if (!user || selectedOpponents.length === 0) {
      alert('Selecione pelo menos um oponente.'); return;
    }
    if (betMode) {
      if (betType === 'xp' || betType === 'both') {
        if (betXpAmount > (user.xp || 0)) {
          alert(`XP insuficiente! Você tem ${user.xp} XP.`); return;
        }
      }
      if (betType === 'coins' || betType === 'both') {
        if (betCoinAmount > (user.coins || 0)) {
          alert(`Moedas insuficientes! Você tem ${user.coins} moedas.`); return;
        }
      }
      // Verifica oponentes (aproximação - eles precisam aceitar depois)
    }

    setLoading(true);
    try {
      const allParticipants = [user.id, ...selectedOpponents];
      const results: Record<string, null> = {};
      allParticipants.forEach(id => { results[id] = null; });

      const duel: DuelData = {
        id: `duel_${Date.now()}`,
        wodId: duelWodId,
        wodName: duelWodName,
        category,
        challengerId: user.id,
        opponentIds: selectedOpponents,
        results,
        status: 'pending',
        winnerId: null,
        betMode,
        betType: betMode ? betType : null,
        betXpAmount: (betMode && (betType === 'xp' || betType === 'both')) ? betXpAmount : null,
        betCoinAmount: (betMode && (betType === 'coins' || betType === 'both')) ? betCoinAmount : null,
        acceptedBy: [],
        betReserved: false,
        betReservedAt: null,
        betSettledAt: null,
        betCanceledAt: null,
        createdAt: Date.now(),
      };

      await createDuelInDb(duel);
      // Notificações e alertas...
    } finally { setLoading(false); }
  };

  const handleRematch = async (duel: DuelData) => {
    if (confirm('Deseja iniciar uma VINGANÇA (Rematch) com os mesmos atletas e aposta?')) {
        // Lógica de criação direta de uma nova luta baseada na anterior
    }
  };

// Interface (Renderização dos Participantes):
{allParts.map((pid, i) => {
    const hasAccepted = pid === duel.challengerId || (duel.acceptedBy || []).includes(pid);
    const isWinner = duel.status === 'finished' && duel.winnerId === pid;
    
    return (
      <div key={pid} className="flex items-center gap-2">
        <div className={cn(
            'w-10 h-10 rounded-full border-2 ...',
            isWinner && 'border-secondary scale-110 ring-2 ring-secondary/50'
        )}>
          <AvatarPreview equipped={...} size="sm" />
          {duel.status === 'pending' && hasAccepted && (
              <Check className="absolute ..." />
          )}
        </div>
      </div>
    );
})}
