import { Calculator, AlertTriangle } from 'lucide-react';
import ReportSheet from './ReportSheet';
import Section from './Section';
import { fmtBRL, fmtNum } from '@/lib/statsUtils';
import {
  COMPONENT_LABELS,
  CALCULATION_VERSION,
  calculateSellingCost,
  unitLabel,
} from '@/lib/industrialCostEngine';

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

// Ficha técnica do Simulador de Preços — motor de custeio v2.0: base
// financeira (DREs usadas), composição auditável por artefato, refugo
// absorvido, custo industrial, custo p/ venda e preço sugerido.
export default function CostingV2Report({ model, products, rowFor, onClose }) {
  const usedMonths = (model.months || []).filter((m) => !m.userExcluded);

  const rows = products
    .map(({ pt, product }) => {
      if (!product) return null;
      const row = rowFor(pt);
      const sell = calculateSellingCost(product.industrialPerUnit, row);
      return { pt, product, sell, goodRatio: product.goodRatio ?? 1, row };
    })
    .filter(Boolean);

  return (
    <ReportSheet
      title="Ficha Técnica — Custeio Industrial"
      subtitle={`Motor de custeio v${model.calculation_version} — composição auditável por artefato, refugo absorvido, sem duplicidades`}
      icon={Calculator}
      hidePeriod
      onClose={onClose}
    >
      <Section title="Base financeira do cálculo">
        {model.average ? (
          <p className="text-xs text-slate-600 leading-relaxed">
            {model.average.label}. Custo industrial total: <strong>{fmtBRL(model.average.industrialTotal)}</strong>;
            custo médio de <strong>{fmtBRL(model.average.costPerKg)}/kg</strong> e{' '}
            <strong>{fmtBRL(model.average.costPerHour)}/hora</strong> sobre a produção boa do período.
          </p>
        ) : (
          <p className="text-xs text-slate-600 leading-relaxed">
            Nenhuma DRE utilizada — apenas custos diretos de cadastro (matéria-prima e molde).
          </p>
        )}
        {usedMonths.length > 0 && (
          <table className="w-full text-xs border-collapse mt-3">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-300">
                <th className="py-1 font-semibold">Mês</th>
                <th className="py-1 font-semibold text-right">Custo industrial</th>
                <th className="py-1 font-semibold text-right">Peças boas</th>
                <th className="py-1 font-semibold text-right">Peso (kg)</th>
                <th className="py-1 font-semibold text-right">Horas</th>
                <th className="py-1 font-semibold text-right">R$/kg</th>
                <th className="py-1 font-semibold text-right">R$/hora</th>
              </tr>
            </thead>
            <tbody>
              {usedMonths.map((m) => (
                <tr key={m.reference_month} className="border-b border-slate-200">
                  <td className="py-1 font-medium text-slate-900">
                    {m.month_label}
                    {m.anomalous && (
                      <span className="text-amber-600 ml-1" title={m.anomalyReasons?.join('; ')}>⚠</span>
                    )}
                  </td>
                  <td className="py-1 text-right">{fmtBRL(m.industrialTotal)}</td>
                  <td className="py-1 text-right">{fmtNum(m.goodUnits, 0)}</td>
                  <td className="py-1 text-right">{fmtNum(m.weightKg, 0)}</td>
                  <td className="py-1 text-right">{fmtNum(m.hours, 1)}</td>
                  <td className="py-1 text-right">{fmtNum(m.costPerKg, 3)}</td>
                  <td className="py-1 text-right">{fmtNum(m.costPerHour, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Composição de custos e preço sugerido por artefato">
        {rows.length === 0 ? (
          <p className="text-xs text-slate-500">Nenhum artefato ativo cadastrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[10px] border-collapse">
              <thead>
                <tr className="text-slate-500 border-b border-slate-300">
                  <th className="py-1.5 font-semibold text-left whitespace-nowrap">Artefato</th>
                  <th className="py-1.5 font-semibold text-center">Un.</th>
                  {REPORT_COMPONENTS.map((key) => (
                    <th key={key} className="py-1.5 font-semibold text-right whitespace-nowrap">{COMPONENT_LABELS[key]}</th>
                  ))}
                  <th className="py-1.5 font-semibold text-right whitespace-nowrap">Perdas/Refugo</th>
                  <th className="py-1.5 font-semibold text-right whitespace-nowrap">Custo Industrial</th>
                  <th className="py-1.5 font-semibold text-right whitespace-nowrap">Custo p/ Venda</th>
                  <th className="py-1.5 font-semibold text-right whitespace-nowrap">Preço Sugerido</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ pt, product, sell, goodRatio, row }) => (
                  <tr key={pt.id} className="border-b border-slate-200">
                    <td className="py-1.5 font-medium text-slate-900 whitespace-nowrap">{pt.name}</td>
                    <td className="py-1.5 text-center text-slate-600">{unitLabel(pt)}</td>
                    {REPORT_COMPONENTS.map((key) => (
                      <td key={key} className="py-1.5 text-right text-slate-700">
                        {fmtNum((product.components[key] || 0) * goodRatio, 3)}
                      </td>
                    ))}
                    <td className="py-1.5 text-right text-amber-700">{fmtNum(product.lossBurden || 0, 3)}</td>
                    <td className="py-1.5 text-right font-semibold">{fmtNum(product.industrialPerUnit, 3)}</td>
                    <td className="py-1.5 text-right">{fmtNum(sell.sellingCost, 3)}</td>
                    <td className="py-1.5 text-right font-bold">
                      {sell.invalid ? '—' : fmtBRL(sell.price)}
                      <span className="block text-[8px] font-normal text-slate-400">margem {Number(row.margin) || 0}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {(model.insufficient?.length > 0 || model.warnings?.length > 0) && (
        <Section title="Observações do cálculo">
          <ul className="text-xs text-slate-600 space-y-1">
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

      <Section title="Como ler esta ficha">
        <p className="text-xs text-slate-600 leading-relaxed">
          Os componentes (matéria-prima, molde, energia, mão de obra, manutenção, depreciação e custos fixos industriais)
          são proporcionais à peça bruta; o ônus do refugo (peças produzidas e não vendíveis) é absorvido pela produção boa
          na coluna <strong>Perdas/Refugo</strong>. A soma dos componentes + perdas é o <strong>custo industrial</strong>{' '}
          por unidade vendável. <strong>Custo p/ venda</strong> adiciona frete, outros, comissão e impostos.{' '}
          <strong>Preço sugerido</strong> = (custo industrial + frete + outros) ÷ (1 − margem − comissão − imposto), com o
          imposto incidindo sobre o preço final. Despesas comerciais, financeiras e impostos da DRE não entram no custo
          industrial; contas já representadas no cálculo operacional não são somadas novamente.
        </p>
      </Section>
    </ReportSheet>
  );
}