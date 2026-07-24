import { Heart } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import HeartRateWidget from '../components/HeartRateWidget';

export default function Frequencia() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="p-6 pt-12 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-headline font-black italic text-on-surface uppercase tracking-tight">Frequência</h1>
          <p className="text-on-surface-variant text-xs font-medium uppercase tracking-widest opacity-60">
            Conecte sua faixa ou relógio
          </p>
        </div>
        <div className="w-12 h-12 rounded-full bg-secondary/10 border border-secondary/20 flex items-center justify-center">
          <Heart className="w-6 h-6 text-secondary" />
        </div>
      </header>

      <div className="px-6">
        <HeartRateWidget userId={user?.id} />
      </div>
    </div>
  );
}
