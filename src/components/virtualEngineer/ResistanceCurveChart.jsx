import {
  LineChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ReferenceLine, ResponsiveContainer,
} from 'recharts';

// Gráfico principal — CURVA DE DESENVOLVIMENTO DA RESISTÊNCIA.
// Legenda distingue claramente REFERÊNCIA / REAL / IA; faixa de referência e
// intervalo IA sombreados; resistência especificada como linha destacada.
export default function ResistanceCurveChart({ series, targetStrength }) {
  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="age_days" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}d`} />
          <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} width={48} />
          <Tooltip
            labelFormatter={(l) => `Idade: ${l} dias`}
            formatter={(v, name) => [`${Number(v).toFixed(2)} MPa`, name]} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {targetStrength > 0 && (
            <ReferenceLine y={targetStrength} stroke="#ef4444" strokeDasharray="6 4"
              label={{ value: `Especificada ${targetStrength} MPa`, fontSize: 10, position: 'insideTopRight', fill: '#ef4444' }} />
          )}
          <Area dataKey={['refLower', 'refUpper']} name="Faixa de Referência" stroke="none" fill="#94a3b8" fillOpacity={0.18} connectNulls />
          <Line type="monotone" dataKey="refCenter" name="REFERÊNCIA" stroke="#64748b" strokeWidth={1.5} strokeDasharray="6 4" dot={false} />
          <Line type="monotone" dataKey="realAvg" name="REAL CimentoPro" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4 }} connectNulls={false} />
          <Area dataKey={['aiLower', 'aiUpper']} name="Intervalo IA" stroke="none" fill="#8b5cf6" fillOpacity={0.15} connectNulls />
          <Line type="monotone" dataKey="aiCenter" name="IA (projeção)" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="4 3" dot={{ r: 3 }} connectNulls={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}