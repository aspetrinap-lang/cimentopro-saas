import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from 'recharts';
import { Printer, X, TrendingUp } from 'lucide-react';
import Section from './Section';

// Ficha A4 — Curva de Crescimento de Resistência: gráfico, tabela por idade,
// leitura técnica da evolução e cabeçalho com os filtros aplicados.
export default function ResistanceGrowthReport({ rows, target, reading, traceName, artifactName, reportCount, onClose }) {
  const issued = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const filters = [
    traceName ? `Traço: ${traceName}` : null,
    artifactName ? `Artefato: ${artifactName}` : null,
  ].filter(Boolean).join('  ·  ') || 'Todos os traços e artefatos';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 overflow-y-auto p-4 md:p-8">
      {/* Barra de ações (fora da área de impressão) */}
      <div className="max-w-[800px] mx-auto mb-3 flex items-center gap-2 rounded-xl bg-white/95 border border-slate-200 shadow px-3 py-2.5">
        <TrendingUp className="w-4 h-4 text-slate-500 shrink-0" />
        <span className="text-xs text-slate-600">Curva de Crescimento de Resistência</span>
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow">
            <Printer className="w-4 h-4" /> Imprimir
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg text-slate-700 hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Folha A4 */}
      <div className="print-area bg-white text-slate-900 mx-auto max-w-[800px] p-8 md:p-10 shadow-2xl rounded-lg">
        <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4 mb-5">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Ficha Técnica — Curva de Crescimento de Resistência</h1>
            <p className="text-xs text-slate-500 mt-0.5">Evolução da resistência dos corpos de prova por idade (7/14/21/28 dias)</p>
          </div>
          <TrendingUp className="w-8 h-8 text-slate-300 shrink-0" />
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6 text-xs">
          <div className="border border-slate-200 rounded-lg p-2.5">
            <p className="text-slate-500 font-semibold uppercase tracking-wide text-[10px]">Filtros aplicados</p>
            <p className="font-medium mt-1">{filters}</p>
          </div>
          <div className="border border-slate-200 rounded-lg p-2.5">
            <p className="text-slate-500 font-semibold uppercase tracking-wide text-[10px]">Emissão</p>
            <p className="font-medium mt-1">{issued}</p>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-10">Nenhum corpo de prova com resultados para o filtro selecionado.</p>
        ) : (
          <>
            <Section title="Gráfico de evolução por idade">
              <div className="border border-slate-200 rounded-lg p-3">
                <LineChart data={rows} width={680} height={280} margin={{ top: 12, right: 24, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="age_days" tick={{ fontSize: 11 }} tickFormatter={v => `${v} dias`} />
                  <YAxis tick={{ fontSize: 11 }} width={44} />
                  <Tooltip labelFormatter={l => `${l} dias`} formatter={(v, name) => [`${v} MPa`, name]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {target > 0 && (
                    <ReferenceLine y={target} stroke="#ef4444" strokeDasharray="6 4"
                      label={{ value: `fck alvo ${target} MPa`, fontSize: 10, position: 'insideTopRight', fill: '#ef4444' }} />
                  )}
                  <Line type="monotone" dataKey="average" name="Resistência média" stroke="#4f46e5" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="fck_est" name="fck estimado" stroke="#059669" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 4 }} />
                </LineChart>
              </div>
              {target > 0 && (
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Linha tracejada vermelha: fck alvo de referência ({target} MPa). Base: {reportCount || 0} laudo(s).
                </p>
              )}
            </Section>

            <Section title="Resultados por idade">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-300">
                    <th className="py-1.5 font-semibold">Idade (dias)</th>
                    <th className="py-1.5 font-semibold text-right">Resistência média (MPa)</th>
                    <th className="py-1.5 font-semibold text-right">fck estimado (MPa)</th>
                    <th className="py-1.5 font-semibold text-right">Nº de corpos de prova</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.age_days} className="border-b border-slate-200">
                      <td className="py-1.5 font-medium text-slate-900">{r.age_days}</td>
                      <td className="py-1.5 text-right">{r.average ? r.average.toFixed(2) : '—'}</td>
                      <td className="py-1.5 text-right font-semibold">{r.fck_est ? r.fck_est.toFixed(2) : '—'}</td>
                      <td className="py-1.5 text-right">{r.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[10px] text-slate-500 mt-1.5">
                fck estimado = média − 1,65 × desvio-padrão da amostra (mínimo de 3 corpos de prova válidos por idade).
              </p>
            </Section>

            <Section title="Leitura técnica da evolução">
              <p className="text-xs text-slate-600 leading-relaxed">{reading}</p>
            </Section>
          </>
        )}

        <p className="text-[10px] text-slate-400 text-center border-t border-slate-200 mt-8 pt-3">
          Relatório gerado automaticamente pelo CimentoPro. Valores conforme os laudos de qualidade registrados.
        </p>
      </div>
    </div>
  );
}