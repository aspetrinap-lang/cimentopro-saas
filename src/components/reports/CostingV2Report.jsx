import { Printer, X, Calculator, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { fmtBRL, fmtNum } from '@/lib/statsUtils';
import {
  COMPONENT_LABELS,
  CALCULATION_VERSION,
  calculateSellingCost,
  unitLabel,
} from '@/lib/industrialCostEngine';
import Section from './Section';

// Colunas de custeio industrial exibidas no relatório (motor v2.0)
const REPORT_COMPONENTS = [
  'material_direct',
  'mold',
  'energy',
  'direct_labor',
  'maintenance',
  'depreciation',
  'factory_overhead',
];

// RELATÓRIO DE CUSTEIO — motor v2.0: composição auditável por artefato
// (componentes proporcionais à peça bruta + ônus do refugo = custo industrial),
// custo para venda e preço sugerido. Imprimível em folha A4.
export default function CostingV2Report({ model, products, rowFor, onClose }) {
  const issued = format(new Date(), "dd/MM/yyyy 'às' HH:mm");

  const rows = products
    .map(({ pt, product }) => {
      if (!product) return null;
      const row = rowFor(pt);
      const sell = calculateSellingCost(product.industrialPerUnit, row);
      return { pt, product, sell, goodRatio: product.goodRatio ?? 1, row };
    })
    .filter(Boolean);

  const usedMonths = (model.months || []).filter((m) => !m.userExcluded);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 overflow-y-auto p-4 md:p-8">
      {/* Barra de ações (fora da área de impressão) */}
      <div className="max-w-[800px] mx-auto mb-3">
        <div className="flex items-center gap-2 rounded-xl bg-white/95 border border-slate-200 shadow px-3 py-2.5">
          <Calculator className="w-4 h-4 text-slate-500 shrink-0" />
          <p className="text-xs font-medium text-slate-700">
            Relatório de Custeio Industrial v{model.calculation_version} — {model.average ? model.average.label : 'sem base financeira'}
          </p>
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow">
              <Printer className="w-4 h-4" /> Imprimir
            </button>
            <button onClick={onClose}
              className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg text-slate-700 hover:bg-slate-100 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Folha A4 */}
      <div className="print-area bg-white text-slate-900 mx-auto max-w-[800px] p-8 md:p-10 shadow-2xl rounded-lg">
        <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4 mb-5">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Relatório de Custeio Industrial</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Motor de custeio v{model.calculation_version} — composição auditável por artefato, refugo absorvido, sem duplicidades
            </p>
          </div>
          <Calculator className="w-8 h-8 text-slate-300 shrink-0" />
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6 text-xs">
          <div className="border border-slate-200 rounded-lg p-2.5">
            <p className="text-slate-500 font-semibold uppercase tracking-wide text-[10px]">Base financeira</p>
            <p className="font-medium mt-1">{model.average ? model.average.label : 'Nenhuma DRE utilizada'}</p>
          </div>
          <div className="border border-slate-200 rounded-lg p-2.5">
            <p className="text-slate-500 font-semibold uppercase tracking-wide text-[10px]">Emissão</p>
            <p className="font-medium mt-1">{issued}</p>
          </div>
        </div>

        {/* Indicadores da base financeira */}
        {model.average && (
          <Section title="Base Financeira do Cálculo">
            <div className="grid grid-cols-4 gap-2 text-xs mb-3">
              <div className="border border-slate-200 rounded-lg p-2">
                <p className="text-slate-500 text-[10px] font-semibold uppercase">Custo industrial total</p>
                <p className="font-medium mt-0.5">{fmtBRL(model.average.industrialTotal)}</p>
              </div>
              <div className="border border-slate-200 rounded-lg p-2">
                <p className="text-slate-500 text-[10px] font-semibold uppercase">Custo por kg</p>
                <p className="font-medium mt-0.5">{fmtBRL(model.average.costPerKg)}</p>
              </div>
              <div className="border border-slate-200 rounded-lg p-2">
                <p className="text-slate-500 text-[10px] font-semibold uppercase">Custo por hora</p>
                <p className="font-medium mt-0.5">{fmtBRL(model.average.costPerHour)}</p>
              </div>
              <div className="border border-slate-200 rounded-lg p-2">
                <p className="text-slate-500 text-[10px] font-semibold uppercase">Meses utilizados</p>
                <p className="font-medium mt-0.5">{usedMonths.length}</p>
              </div>
            </div>
            <table className="w-full text-[10px]">
              <thead>
                <tr className="border-b border-slate-300 text-slate-500">
                  <th className="text-left py-1 font-semibold">Mês</th>
                  <th className="text-right py-1 font-semibold">Custo industrial (R$)</th>
                  <th className="text-right py-1 font-semibold">Peças boas</th>
                  <th className="text-right py-1 font-semibold">Peso (kg)</th>
                  <th className="text-right py-1 font-semibold">Horas</th>
                  <th className="text-right py-1 font-semibold">R$/kg</th>
                  <th className="text-right py-1 font-semibold">R$/h</th>
                </tr>
              </thead>
              <tbody>
                {usedMonths.map((m) => (
                  <tr key={m.reference_month} className="border-b border-slate-100">
                    <td className="py-1">
                      {m.month_label}
                      {m.anomalous && <span className="text-amber-600 ml-1" title={m.anomalyReasons?.join('; ')}>⚠</span>}
                    </td>
                    <td className="py-1 text-right">{fmtNum(m.industrialTotal, 2)}</td>
                    <td className="py-1 text-right">{fmtNum(m.goodUnits, 0)}</td>
                    <td className="py-1 text-right">{fmtNum(m.weightKg, 0)}</td>
                    <td className="py-1 text-right">{fmtNum(m.hours, 1)}</td>
                    <td className="py-1 text-right">{fmtNum(m.costPerKg, 3)}</td>
                    <td className="py-1 text-right">{fmtNum(m.costPerHour, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {/* Composição de custos por artefato */}
        <Section title="Composição de Custos por Artefato (motor v2.0)">
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="border-b border-slate-300 text-slate-500">
                  <th className="text-left py-1.5 font-semibold whitespace-nowrap">Artefato</th>
                  <th className="text-center py-1.5 font-semibold">Un.</th>
                  {REPORT_COMPONENTS.map((key) => (
                    <th key={key} className="text-right py-1.5 font-semibold whitespace-nowrap">{COMPONENT_LABELS[key]}</th>
                  ))}
                  <th className="text-right py-1.5 font-semibold">Perdas/Refugo</th>
                  <th className="text-right py-1.5 font-semibold">Custo Industrial</th>
                  <th className="text-right py-1.5 font-semibold">Custo p/ Venda</th>
                  <th className="text-right py-1.5 font-semibold">Preço Sugerido</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ pt, product, sell, goodRatio, row }) => (
                  <tr key={pt.id} className="border-b border-slate-100">
                    <td className="py-1.5 font-medium whitespace-nowrap">{pt.name}</td>
                    <td className="py-1.5 text-center text-slate-500">{unitLabel(pt)}</td>
                    {REPORT_COMPONENTS.map((key) => (
                      <td key={key} className="py-1.5 text-right text-slate-700">
                        {fmtNum((product.components[key] || 0) * goodRatio, 3)}
                      </td>
                    ))}
                    <td className="py-1.5 text-right text-amber-700">{fmtNum(product.lossBurden || 0, 3)}</td>
                    <td className="py-1.5 text-right font-semibold">{fmtNum(product.industrialPerUnit, 3)}</td>
                    <td className="py-1.5 text-right">{fmtNum(sell.sellingCost, 3)}</td>
                    <td className="py-1.5 text-right font-bold">
                      {sell.invalid ? '—' : fmtNum(sell.price, 2)}
                      <span className="block text-[8px] font-normal text-slate-400">margem {Number(row.margin) || 0}%</span>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={14} className="py-4 text-center text-slate-400">Nenhum artefato ativo para exibir.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-[9px] text-slate-400 mt-2">
            Componentes proporcionais à peça bruta (R$/un); o ônus do refugo (peças produzidas e não vendíveis) é absorvido pela
            produção boa na coluna Perdas/Refugo. Soma dos componentes + perdas = Custo Industrial por unidade vendável.
            Comerciais, financeiras e impostos da DRE não entram no custo industrial. Preço Sugerido = (Custo Industrial + Frete + Outros) ÷ (1 − Margem% − Comissão% − Imposto%).
          </p>
        </Section>

        {/* Observações / avisos do cálculo */}
        {(model.insufficient?.length > 0 || model.warnings?.length > 0) && (
          <Section title="Observações do Cálculo">
            <ul className="text-[10px] text-slate-600 space-y-1">
              {model.insufficient?.map((msg, i) => (
                <li key={`i${i}`} className="flex items-start gap-1.5">
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0 text-amber-600" /> {msg}
                </li>
              ))}
              {model.warnings?.map((w, i) => (
                <li key={`w${i}`} className="flex items-start gap-1.5">
                  <span className="text-slate-400 shrink-0">•</span> {w.account_name}: {w.reason}
                </li>
              ))}
            </ul>
          </Section>
        )}

        <p className="text-[10px] text-slate-400 text-center border-t border-slate-200 mt-8 pt-3">
          Relatório gerado automaticamente pelo CimentoPro — motor de custeio v{CALCULATION_VERSION}. Valores conforme a base financeira e a produção registradas.
        </p>
      </div>
    </div>
  );
}