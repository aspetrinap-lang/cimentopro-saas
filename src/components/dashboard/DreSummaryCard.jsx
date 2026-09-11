import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { scopedFilter } from '@/lib/companyScope';
import { FileSpreadsheet, TrendingUp, TrendingDown } from 'lucide-react';
import { fmtBRL, fmtNum } from '@/lib/statsUtils';

// Totais da DRE do mês — usa os caches e recalcula a partir das linhas quando
// a DRE foi salva antes dos campos separados (mesma regra da Análise de Custos).
function dreTotals(d) {
  const items = d.items || [];
  const sum = (filter, field) => items.filter(filter).reduce((s, i) => s + (Number(i[field]) || 0), 0);
  const receita = d.total_receita_actual != null ? Number(d.total_receita_actual) || 0 : sum((i) => i.category === 'Receita', 'actual_value');
  const despesa = d.total_despesa_actual != null ? Number(d.total_despesa_actual) || 0 : sum((i) => i.category !== 'Receita', 'actual_value');
  const receitaPlanned = d.total_receita_planned != null ? Number(d.total_receita_planned) || 0 : sum((i) => i.category === 'Receita', 'planned_value');
  const despesaPlanned = d.total_despesa_planned != null ? Number(d.total_despesa_planned) || 0 : sum((i) => i.category !== 'Receita', 'planned_value');
  const resultado = receita - despesa;
  return {
    receita, despesa, resultado,
    margem: receita > 0 ? (resultado / receita) * 100 : null,
    resultadoPlanned: receitaPlanned - despesaPlanned,
    receitaPlanned,
  };
}

function deltaLabel(current, previous, fmt) {
  if (previous == null || previous === 0) return null;
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const up = pct >= 0;
  return (
    <span className={`flex items-center gap-0.5 ${up ? 'text-green-600' : 'text-red-600'}`}>
      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {fmt(Math.abs(pct), 1)}% vs mês anterior
    </span>
  );
}

// Indicadores financeiros da DRE no Dashboard: Receita, Custos e Despesas,
// Resultado e Margem — com comparação contra o mês anterior e o orçado.
export default function DreSummaryCard() {
  const [dres, setDres] = useState(null);

  useEffect(() => {
    base44.entities.MonthlyDre.filter(scopedFilter(), '-reference_month', 24).then(setDres).catch(() => setDres([]));
  }, []);

  if (dres == null) return null;
  if (!dres.length) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
        <FileSpreadsheet className="w-5 h-5 text-primary shrink-0" />
        <div className="text-xs text-muted-foreground">
          Nenhuma DRE importada.{' '}
          <Link to="/costs" className="text-primary hover:underline">Importe a DRE mensal na Análise de Custos</Link>{' '}
          para acompanhar Receita, Custos, Resultado e Margem.
        </div>
      </div>
    );
  }

  const sorted = [...dres].sort((a, b) => String(a.reference_month).localeCompare(String(b.reference_month)));
  const current = dreTotals(sorted[sorted.length - 1]);
  const prev = sorted.length > 1 ? dreTotals(sorted[sorted.length - 2]) : null;
  const label = sorted[sorted.length - 1].month_label || sorted[sorted.length - 1].reference_month;

  // Evolução mensal da receita e do resultado (últimos meses)
  const evolution = sorted.map((d) => ({ label: d.month_label || d.reference_month, ...dreTotals(d) }));

  const stat = (labelText, value, sub) => (
    <div className="bg-card rounded-xl p-4 border border-border">
      <p className="text-xs text-muted-foreground">{labelText}</p>
      <p className="text-lg font-bold text-foreground mt-1">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-primary" /> DRE — {label}
        </h2>
        <div className="flex items-end gap-1 h-8" title="Evolução mensal: receita e resultado">
          {evolution.map((e) => (
            <div key={e.label} className="flex flex-col justify-end gap-0.5" title={`${e.label}: Receita ${fmtBRL(e.receita)} · Resultado ${fmtBRL(e.resultado)}`}>
              <div className="w-3 rounded-t bg-primary/70" style={{ height: `${Math.max(2, Math.min(24, (e.receita / Math.max(...evolution.map((x) => x.receita || 1))) * 24))}px` }} />
              <div className={`w-3 rounded-b ${e.resultado >= 0 ? 'bg-green-500/60' : 'bg-red-500/60'}`} style={{ height: `${Math.max(2, Math.min(24, (Math.abs(e.resultado) / Math.max(...evolution.map((x) => Math.abs(x.resultado) || 1))) * 24))}px` }} />
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stat('Receita (realizado)', fmtBRL(current.receita), deltaLabel(current.receita, prev?.receita, fmtNum))}
        {stat('Custos e Despesas', fmtBRL(current.despesa), deltaLabel(current.despesa, prev?.despesa, fmtNum))}
        {stat('Resultado', fmtBRL(current.resultado), (
          <span className="text-muted-foreground">Orçado: {fmtBRL(current.resultadoPlanned)}</span>
        ))}
        {stat('Margem', current.margem != null ? `${fmtNum(current.margem, 1)}%` : '—', prev?.margem != null && current.margem != null
          ? <span className={current.margem >= prev.margem ? 'text-green-600' : 'text-red-600'}>{fmtNum(current.margem - prev.margem, 1)} p.p. vs mês anterior</span>
          : null)}
      </div>
    </section>
  );
}