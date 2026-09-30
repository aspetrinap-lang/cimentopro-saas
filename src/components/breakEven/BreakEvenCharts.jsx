import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line, Legend, Cell,
} from 'recharts';
import { fmtBRL, fmtNum } from '@/lib/statsUtils';

const COLORS = {
  revenue: '#10b981',
  pec: '#6366f1',
  pef: '#f59e0b',
  pee: '#ef4444',
};

const moneyTick = (v) => (Math.abs(v) >= 1000 ? `R$ ${fmtNum(v / 1000, 0)}k` : `R$ ${fmtNum(v, 0)}`);
const tooltipMoney = (v) => fmtBRL(v);

function ChartBox({ title, children }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-xs font-semibold text-foreground mb-3">{title}</p>
      {children}
    </div>
  );
}

// Gráficos do Ponto de Equilíbrio v1.1 — somente valores reais calculados pelo
// breakEvenEngine (PE null não é plotado como zero).
export default function BreakEvenCharts({ analysis }) {
  // 1. Faturamento × Pontos de Equilíbrio (comparativo)
  const beData = [
    { name: 'Faturamento atual', valor: analysis.revenue.gross, color: COLORS.revenue },
    { name: 'PEC', valor: analysis.pec.breakEvenRevenue, color: COLORS.pec },
    { name: 'PEF', valor: analysis.pef.breakEvenRevenue, color: COLORS.pef },
    { name: 'PEE', valor: analysis.pee.breakEvenRevenue, color: COLORS.pee },
  ].filter((d) => d.valor != null);

  // 2. Composição dos valores do período por natureza
  const compData = [
    { name: 'Deduções', valor: analysis.revenue.deductions },
    { name: 'Variáveis', valor: analysis.variableCosts.total },
    { name: 'Fixos Operacionais', valor: analysis.fixedOperationalCosts },
    { name: 'Financeiro (PEF)', valor: analysis.financialCashCosts },
    { name: 'Investimentos', valor: analysis.investments },
    { name: 'Não Caixa', valor: analysis.fixedNonCashCosts + analysis.financialNonCashCosts },
  ].filter((d) => d.valor > 0);

  // 3. Evolução mensal — cada mês calculado individualmente (≥ 2 DREs);
  //    o resultado do período NUNCA é média destes valores (consolidação por soma).
  const showEvolution = analysis.monthlySeries.length >= 2;
  const evolutionData = analysis.monthlySeries.map((m) => ({
    mes: m.month,
    Faturamento: m.revenue,
    PEC: m.pec,
    PEF: m.pef,
    PEE: m.pee,
  }));

  return (
    <div className="space-y-3">
      <ChartBox title="Faturamento × Pontos de Equilíbrio (PEC / PEF / PEE)">
        {beData.length ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={beData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={moneyTick} tick={{ fontSize: 11 }} width={80} />
                <Tooltip formatter={tooltipMoney} />
                <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
                  {beData.map((d) => <Cell key={d.name} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-10">Sem valores calculáveis no período selecionado.</p>
        )}
      </ChartBox>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <ChartBox title="Composição dos Valores do Período">
          {compData.length ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={compData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                  <YAxis tickFormatter={moneyTick} tick={{ fontSize: 11 }} width={80} />
                  <Tooltip formatter={tooltipMoney} />
                  <Bar dataKey="valor" fill="#64748b" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-10">Nenhuma conta classificada na DRE do período.</p>
          )}
        </ChartBox>

        <ChartBox title="Evolução do Ponto de Equilíbrio (por mês)">
          {showEvolution ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evolutionData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={moneyTick} tick={{ fontSize: 11 }} width={80} />
                  <Tooltip formatter={tooltipMoney} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="Faturamento" stroke={COLORS.revenue} dot={false} connectNulls strokeWidth={2} />
                  <Line type="monotone" dataKey="PEC" stroke={COLORS.pec} dot={false} connectNulls strokeWidth={2} />
                  <Line type="monotone" dataKey="PEF" stroke={COLORS.pef} dot={false} connectNulls strokeWidth={2} />
                  <Line type="monotone" dataKey="PEE" stroke={COLORS.pee} dot={false} connectNulls strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-10">
              A evolução mensal aparece quando existirem pelo menos 2 DREs no período selecionado.
            </p>
          )}
        </ChartBox>
      </div>
    </div>
  );
}