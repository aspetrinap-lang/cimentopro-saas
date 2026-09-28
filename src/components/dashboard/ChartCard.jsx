import { Maximize2 } from 'lucide-react';
import { useState } from 'react';
import ChartFullscreenModal from './ChartFullscreenModal';

export const TOP_PREVIEW = 5;

// Card padrão do Centro de Controle: título, descrição e botão expandir.
// `children` é a versão compacta (TOP 5). `expandedChart` é a versão completa
// (todos os itens) exibida no modal. Se omitida, reutiliza `children`.
// `detailView` abre abas Resumo | Detalhamento no modal.
export default function ChartCard({
  title,
  description,
  icon: Icon,
  children,
  expandedChart,
  detailView,
  actions,
  className = '',
  bodyClassName = '',
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className={`bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col ${className}`}>
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
          <div className="flex items-start gap-2 min-w-0">
            {Icon && (
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                <Icon className="w-4 h-4 text-blue-600" />
              </div>
            )}
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-800 truncate">{title}</h3>
              {description && <p className="text-xs text-slate-500 mt-0.5 leading-snug">{description}</p>}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {actions}
            <button
              onClick={() => setOpen(true)}
              title="Ampliar gráfico"
              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className={`px-5 pb-5 flex-1 ${bodyClassName}`}>{children}</div>
      </div>

      {open && (
        <ChartFullscreenModal
          title={title}
          description={description}
          onClose={() => setOpen(false)}
          detailView={detailView}
        >
          {expandedChart || children}
        </ChartFullscreenModal>
      )}
    </>
  );
}