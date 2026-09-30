import { Store } from 'lucide-react';

// Marketplace — aba placeholder ("em breve"): nenhuma funcionalidade ainda,
// nenhum botão de ação. Ação "Relatar problema" permanece acessível apenas
// pelo fluxo de suporte do aplicativo.
export default function Marketplace() {
  return (
    <div className="p-4 md:p-6">
      <div
        className="rounded-2xl overflow-hidden flex flex-col items-center justify-center text-center px-6 py-24 md:py-32"
        style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E1B4B 55%, #312E81 100%)' }}
      >
        <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center mb-8">
          <Store className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-5xl md:text-6xl font-bold text-white tracking-tight">Marketplace</h1>
        <span className="mt-6 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-white/10 border border-white/20 backdrop-blur text-sm md:text-base font-medium text-white/85">
          Em breve
        </span>
        <p className="mt-6 text-lg md:text-xl text-white/70 max-w-xl">
          Em breve — novidades e integrações para sua fábrica.
        </p>
      </div>
    </div>
  );
}