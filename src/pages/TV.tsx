      <div className="flex-1 grid grid-cols-12 gap-6 overflow-hidden">
        {/* Esquerda: WOD (maior quando em modo live) */}
        <div className={`flex flex-col gap-6 ${liveWorkoutMode ? 'col-span-6' : 'col-span-8'}`}>
          {/* Tabs do WOD */}
          <div className="flex items-center justify-between bg-[#111] rounded-3xl p-3 border border-white/5">
            {/* ... mantenha todo o código das tabs (WARM-UP, SKILL, THE WOD) que você já tem ... */}
          </div>

          <div className="flex-1 relative">
            <AnimatePresence mode="wait">
              {/* Mantenha aqui as 3 seções (warmup, skill, wod) que você já tinha */}
            </AnimatePresence>
          </div>
        </div>

        {/* Direita: Ranking + Frequência Cardíaca */}
        <div className={`flex flex-col gap-6 ${liveWorkoutMode ? 'col-span-6' : 'col-span-4'}`}>
          
          {/* Ranking - sempre visível, mas menor no modo live */}
          <section className="bg-[#111] rounded-[2.5rem] p-5 border border-white/5 flex flex-col" 
                   style={{ flex: liveWorkoutMode ? '1.1 1 0' : '2 1 0' }}>
            {/* ... mantenha todo o código do TOP 3 e ranking que você já tem ... */}
          </section>

          {/* Painel de Frequência Cardíaca - só aparece no modo live */}
          {liveWorkoutMode && (
            <section className="bg-[#111] rounded-[2.5rem] p-6 border border-white/5 flex-1 flex flex-col overflow-hidden">
              <div className="flex justify-between items-center mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-2xl bg-red-500/10 flex items-center justify-center">
                    <Heart className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-headline font-black uppercase italic tracking-tighter">FREQUÊNCIA CARDÍACA</h3>
                    <p className="text-red-500 text-sm font-black tracking-widest">AO VIVO • TREINO ATUAL</p>
                  </div>
                </div>
                <div className="bg-red-500/10 text-red-500 px-5 py-1.5 rounded-2xl font-black text-sm">
                  {data?.checkins?.length || 0} ATLETAS
                </div>
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar space-y-3">
                {data?.checkins?.length > 0 ? (
                  data.checkins.map((c: any, index: number) => {
                    const profile = c?.profiles;
                    const bpm = Math.floor(Math.random() * 45) + 125; // mock temporário
                    const intensity = bpm > 165 ? '🔴' : bpm > 145 ? '🟠' : '🟢';

                    return (
                      <div key={c.id} className="flex items-center justify-between bg-zinc-900/70 hover:bg-zinc-900 rounded-2xl p-5 border border-white/10">
                        <div className="flex items-center gap-4">
                          <AvatarPreview 
                            equipped={profile?.avatar_equipped} 
                            size="md"
                            className="border-2 border-white/30" 
                          />
                          <div>
                            <p className="font-headline font-black text-xl tracking-tight">
                              {profile?.name?.split(' ')[0] || 'Atleta'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-right">
                          <div className="text-6xl font-headline font-black tabular-nums text-white">
                            {bpm}
                          </div>
                          <div>
                            <div className="text-xs text-white/60">BPM</div>
                            <div className="text-2xl">{intensity}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="h-full flex items-center justify-center text-white/30 text-center">
                    Aguardando check-ins dos atletas...
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
