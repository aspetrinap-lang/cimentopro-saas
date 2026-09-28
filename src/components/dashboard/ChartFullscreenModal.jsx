import { X } from 'lucide-react';
import { useState } from 'react';

// Modal ampliado reutilizável: ~90% da tela no desktop, tela cheia no mobile.
// Renderiza exatamente o mesmo gráfico (children) + visão Resumo | Detalhamento
// quando houver `detailView`.
export default function ChartFullscreenModal({
  title,
  description,
  onClose,
  children,
  detailView,
}) {
  const [tab, setTab] = useState('summary');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 md:p-6">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[90vw] h-[90vh] md:max-w-[90vw] flex flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-slate-200">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-800 truncate">{title}</h3>
            {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {detailView && (
          <div className="flex gap-1 px-6 pt-3">
            <button
              onClick={() => setTab('summary')}
              className={`px-4 py-2 text-xs font-medium rounded-t-lg transition-colors ${
                tab === 'summary'
                  ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Resumo
            </button>
            <button
              onClick={() => setTab('detail')}
              className={`px-4 py-2 text-xs font-medium rounded-t-lg transition-colors ${
                tab === 'detail'
                  ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Detalhamento
            </button>
          </div>
        )}

        <div className="flex-1 overflow-auto p-6 flex flex-col min-h-0">
          <div className="flex-1 min-h-0">
            {tab === 'summary' || !detailView ? children : detailView}
          </div>
        </div>
      </div>
    </div>
  );
}