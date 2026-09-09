import { INSUMO_KEYS, INSUMO_FIELDS } from '@/lib/insumos';
import { useInsumoNames } from '@/hooks/useInsumoNames';
import { consumptionDeviation } from '@/lib/productionMetrics';

// Tabela de desvio de consumo por insumo, uma linha por ordem — mesmo critério
// da ficha técnica da ordem (teórico = produzido × consumo por unidade do artefato).
// Exibe apenas os insumos com lançamento real no conjunto de ordens.
export default function InsumoDeviationTable({ orders, ptMap, maxRows = 40 }) {
  const { names } = useInsumoNames();

  const activeKeys = INSUMO_KEYS.filter((key) =>
    orders.some((o) => consumptionDeviation(o, ptMap[o.product_type_id], INSUMO_FIELDS[key]))
  );

  if (activeKeys.length === 0) {
    return <p className="text-xs text-slate-500">Nenhum lançamento de consumo real no período.</p>;
  }

  const withData = orders.filter((o) =>
    activeKeys.some((key) => consumptionDeviation(o, ptMap[o.product_type_id], INSUMO_FIELDS[key]))
  );
  const rows = withData.slice(0, maxRows);

  return (
    <>
      <table className="w-full text-[10px] border-collapse">
        <thead>
          <tr className="text-left text-slate-500 border-b border-slate-300">
            <th className="py-1.5 font-semibold">Ordem</th>
            <th className="py-1.5 font-semibold">Data</th>
            <th className="py-1.5 font-semibold">Artefato</th>
            <th className="py-1.5 font-semibold text-right">Qtd Real</th>
            {activeKeys.map((key) => (
              <th key={key} className="py-1.5 font-semibold text-right whitespace-nowrap">{names[key]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => {
            const devs = activeKeys.map((key) => ({ key, dev: consumptionDeviation(o, ptMap[o.product_type_id], INSUMO_FIELDS[key]) }));
            return (
              <tr key={o.id} className="border-b border-slate-200">
                <td className="py-1 font-medium text-slate-900 whitespace-nowrap">{o.order_number}</td>
                <td className="py-1 text-slate-600 whitespace-nowrap">{o.production_date}</td>
                <td className="py-1 text-slate-600">{o.product_type_name || '—'}</td>
                <td className="py-1 text-right">{(Number(o.actual_quantity) || 0).toLocaleString('pt-BR')}</td>
                {devs.map(({ key, dev }) => (
                  <td key={key} className="py-1 text-right font-medium whitespace-nowrap">
                    {dev ? (
                      <span className={dev.lossPct > 0 ? 'text-red-600' : 'text-green-700'}>
                        {dev.lossPct > 0 ? '+' : ''}{dev.lossPct.toFixed(1).replace('.', ',')}%
                      </span>
                    ) : '—'}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {withData.length > maxRows && (
        <p className="text-[10px] text-slate-500 mt-1.5">
          Exibindo as {maxRows} primeiras de {withData.length} ordens com consumo lançado.
        </p>
      )}
    </>
  );
}