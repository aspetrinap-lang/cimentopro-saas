import { Link, useLocation } from 'react-router-dom';
import { Bug, Store } from 'lucide-react';

// Marketplace — aba placeholder ("em breve"): nenhuma funcionalidade ainda.
// Única ação funcional: "Relatar problema" (movido do rodapé do menu),
// que abre o fluxo existente do suporte com o contexto da página atual.
export default function Marketplace() {
  const location = useLocation();
  return (
    <div className="p-4 md:p-6">
      <div
        className="rounded-2xl overflow-hidden flex flex-col items-center justify-center text-center px-6 py-20 md:py-28"
        style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E1B4B 55%, #312E81 100%)' }}
      >
        <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center mb-6">
          <Store className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">Marketplace</h1>
        <span className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/20 backdrop-blur text-xs font-medium text-white/85">
          Em breve
        </span>
        <p className="mt-4 text-sm md:text-base text-white/60 max-w-md">
          Em breve — novidades e integrações para sua fábrica.
        </p>
        <Link
          to={`/suporte/novo?relatar=1&page=${encodeURIComponent(location.pathname)}`}
          className="mt-8 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-slate-900 text-sm font-semibold shadow-sm hover:bg-white/90 transition-colors"
        >
          <Bug className="w-4 h-4" /> Relatar problema
        </Link>
      </div>
    </div>
  );
}