import { Calculator, AlertTriangle } from 'lucide-react';
import ReportSheet from './ReportSheet';
import Section from './Section';
import { fmtBRL, fmtNum } from '@/lib/statsUtils';
import { calculateSellingCost, unitLabel } from '@/lib/industrialCostEngine';
import { historyRangeLabel } from '@/lib/pricingProductivity';

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

// Rótulos abreviados da tabela para caber na largura A4 (legenda abaixo da tabela)
const SHORT_LABELS = {
  material_direct: 'Mat-Prima',
  mold: 'Molde',
  energy: 'Energia',
  direct_labor: 'Mão Obra',
  maintenance: 'Manut.',
  depreciation: 'Deprec.',
  factory_overhead: 'Fixos Ind.',
};

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
      subtitle={`Motor de custeio v${model.calculation_version} — composição por artefato, refugo absorvido, sem duplicidades`}
      icon={Calculator}
      hidePeriod
      onClose={onClose}
    >
      <Section title="Base financeira do cálculo">
        {model.average ? (
          <p className="text-[10px] text-slate-600 leading-snug">
            Período: <strong>{model.periodLabel}</strong> · Método: <strong>média ponderada</strong> (Σ custos ÷ Σ base
            produtiva) — custo industrial total <strong>{fmtBRL(model.average.industrialTotal)}</strong>, ponderando{' '}
            <strong>{fmtBRL(model.average.costPerKg)}/kg</strong> e <strong>{fmtBRL(model.average.costPerHour)}/hora</strong> pela
            produção boa. Base produtiva: histórico completo de ordens concluídas
            {model.productivity?.from ? ` (${historyRangeLabel(model.productivity.from, model.productivity.to)})` : ''}.
          </p>
        ) : (
          <p className="text-[10px] text-slate-600 leading-snug">
            Nenhuma DRE utilizada — apenas custos diretos de cadastro (matéria-prima e molde).
          </p>
        )}
        {usedMonths.length > 0 && (
          <table className="w-full text-[10px] border-collapse mt-2">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-300">
                <th className="py-0.5 font-semibold">Mês</th>
                <th className="py-0.5 font-semibold text-right">Custo industrial</th>
                <th className="py-0.5 font-semibold text-right">Peças boas</th>
                <th className="py-0.5 font-semibold text-right">Peso (kg)</th>
                <th className="py-0.5 font-semibold text-right">Horas</th>
                <th className="py-0.5 font-semibold text-right">R$/kg</th>
                <th className="py-0.5 font-semibold text-right">R$/hora</th>
              </tr>
            </thead>
            <tbody>
              {usedMonths.map((m) => (
                <tr key={m.reference_month} className="border-b border-slate-200">
                  <td className="py-0.5 font-medium text-slate-900">
                    {m.month_label}
                    {m.anomalous && (
                      <span className="text-amber-600 ml-1" title={m.anomalyReasons?.join('; ')}>⚠</span>
                    )}
                  </td>
                  <td className="py-0.5 text-right">{fmtBRL(m.industrialTotal)}</td>
                  <td className="py-0.5 text-right">{fmtNum(m.goodUnits, 0)}</td>
                  <td className="py-0.5 text-right">{fmtNum(m.weightKg, 0)}</td>
                  <td className="py-0.5 text-right">{fmtNum(m.hours, 1)}</td>
                  <td className="py-0.5 text-right">{fmtNum(m.costPerKg, 3)}</td>
                  <td className="py-0.5 text-right">{fmtNum(m.costPerHour, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Composição de custos e preço sugerido por artefato">
        {rows.length === 0 ? (
          <p className="text-[10px] text-slate-500">Nenhum artefato ativo cadastrado.</p>
        ) : (
          <>
            <table className="w-full text-[8.5px] border-collapse table-fixed">
              <colgroup>
                <col className="w-[26%]" />
                {REPORT_COMPONENTS.map((key) => (
                  <col key={key} />
                ))}
                <col />
                <col />
                <col />
                <col className="w-[13%]" />
              </colgroup>
              <thead>
                <tr className="text-slate-500 border-b border-slate-300">
                  <th className="py-0.5 font-semibold text-left">Artefato (un.)</th>
                  {REPORT_COMPONENTS.map((key) => (
                    <th key={key} className="py-0.5 px-0.5 font-semibold text-right">{SHORT_LABELS[key]}</th>
                  ))}
                  <th className="py-0.5 px-0.5 font-semibold text-right">Refugo</th>
                  <th className="py-0.5 px-0.5 font-semibold text-right">Custo Ind.</th>
                  <th className="py-0.5 px-0.5 font-semibold text-right">C/ Venda</th>
                  <th className="py-0.5 px-0.5 font-semibold text-right">Preço Sug.</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ pt, product, sell, goodRatio, row }) => (
                  <tr key={pt.id} className="border-b border-slate-200">
                    <td className="py-0.5 pr-1 font-medium text-slate-900 truncate" title={`${pt.name} (${unitLabel(pt)})`}>
                      {pt.name} <span className="font-normal text-slate-500">({unitLabel(pt)})</span>
                    </td>
                    {REPORT_COMPONENTS.map((key) => (
                      <td key={key} className="py-0.5 px-0.5 text-right text-slate-700">
                        {fmtNum((product.components[key] || 0) * goodRatio, 3)}
                      </td>
                    ))}
                    <td className="py-0.5 px-0.5 text-right text-amber-700">{fmtNum(product.lossBurden || 0, 3)}</td>
                    <td className="py-0.5 px-0.5 text-right font-semibold">{fmtNum(product.industrialPerUnit, 3)}</td>
                    <td className="py-0.5 px-0.5 text-right">{fmtNum(sell.sellingCost, 3)}</td>
                    <td className="py-0.5 px-0.5 text-right font-bold">
                      {sell.invalid ? '—' : fmtBRL(sell.price)}
                      <span className="block text-[6.5px] font-normal text-slate-400">marg. {Number(row.margin) || 0}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[8px] text-slate-400 mt-1">
              Legenda: Mat-Prima matéria-prima direta · Mão Obra mão de obra direta · Manut. manutenção · Deprec. depreciação ·
              Fixos Ind. custos fixos industriais · Refugo ônus das perdas · Custo Ind. custo industrial · C/ Venda custo p/ venda ·
              Preço Sug. preço sugerido (marg. = margem aplicada). Valores em R$ por unidade.
            </p>
          </>
        )}
      </Section>

      {(model.insufficient?.length > 0 || model.warnings?.length > 0) && (
        <Section title="Observações do cálculo">
          <ul className="text-[10px] text-slate-600 space-y-0.5">
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
        <p className="text-[10px] text-slate-600 leading-snug">
          Componentes proporcionais à peça bruta; o ônus do refugo é absorvido pela produção boa na coluna <strong>Refugo</strong>.
          Componentes + refugo = <strong>custo industrial</strong> por unidade vendável; <strong>c/ venda</strong> soma frete, outros,
          comissão e impostos. <strong>Preço sugerido</strong> = (custo industrial + frete + outros) ÷ (1 − margem − comissão −
          imposto). Despesas comerciais, financeiras e impostos da DRE não entram no custo industrial; contas já representadas no
          cálculo operacional não são somadas novamente.
        </p>
      </Section>
    </ReportSheet>
  );
}