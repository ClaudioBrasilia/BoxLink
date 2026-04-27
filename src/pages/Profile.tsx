import React from 'react';
import { useAuth } from '../context/AuthContext';
import AvatarPreview from '../components/AvatarPreview';
import { AvatarSlot } from '../types';

export default function Profile() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      <h1 className="text-4xl font-black text-primary italic mb-8 uppercase tracking-tighter">PERFIL</h1>

      <div className="flex flex-col items-center gap-6 mb-12">
        <div className="relative p-1 rounded-full bg-gradient-to-b from-primary to-secondary">
          <AvatarPreview 
            equipped={user?.avatar?.equipped || {} as AvatarSlot} 
            size="xl" 
            className="w-40 h-40 border-4 border-background"
          />
          <div className="absolute -right-2 top-0 bg-primary text-background px-3 py-1 rounded-full text-xs font-black italic">
            ALUNO
          </div>
        </div>

        <div className="text-center">
          <h2 className="text-3xl font-black text-on-surface uppercase italic">{user?.name || 'ATLETA'}</h2>
          <p className="text-on-surface-variant text-sm font-medium">{user?.email}</p>
          
          <div className="flex gap-2 mt-4 justify-center">
            <span className="bg-primary/20 text-primary px-4 py-1 rounded-full text-xs font-bold">NÍVEL {user?.level || 1}</span>
            <span className="bg-secondary/20 text-secondary px-4 py-1 rounded-full text-xs font-bold uppercase italic">Atleta Pro</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-surface-container-high p-4 rounded-3xl border border-primary/10">
          <p className="text-[10px] font-black text-primary uppercase mb-1">Pontos XP</p>
          <p className="text-3xl font-black text-on-surface italic">{user?.xp || 0}</p>
        </div>
        <div className="bg-surface-container-high p-4 rounded-3xl border border-secondary/10">
          <p className="text-[10px] font-black text-secondary uppercase mb-1">Brazacoins</p>
          <p className="text-3xl font-black text-on-surface italic">{user?.coins || 0}</p>
        </div>
      </div>
      
      {/* Continue o resto do seu código de recordes aqui... */}
    </div>
  );
}
