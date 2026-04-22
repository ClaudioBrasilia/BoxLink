export interface BoxSettings {
  // ... outros campos
  timezone: string;
  avatar_enabled?: boolean; // Adicione esta linha
  modules: {
    economy: boolean;
    store: boolean;
    duels: boolean;
    challenges: boolean;
    clans: boolean;
  };
  max_clan_members: number;
}
