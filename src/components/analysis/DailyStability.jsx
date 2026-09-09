import { useState, Fragment } from 'react';
import { stdDev } from '@/lib/utils';
import { TrendingDown, TrendingUp, ChevronDown, ChevronUp, AlertTriangle, Wrench } from 'lucide-react';

function stabilityColor(cv) {
  if (cv <= 10) return { text: 'text-green-600', bar: 'bg-green-500', label: 'Estável' };
  if (cv <= 25) return { text: 'text-amber-600', bar: 'bg-amber-500', label: 'Variação média' };
  return { text: 'text-red-600', bar: 'bg-red-500', label: 'Instável' };
}

function buildIndex(records, machineField = 'machine_id') {
  const idx = {};
  records.forEach(r => {
    const date = (r.date || '').slice(0, 10);
    const mid = r[machineField];
    if (!date || !mid) return;
    if (!idx[date]) idx[date] = {};
    if (!idx[date][mid]) idx[date][mid] = [];
    idx[date][mid].push(r);
  });
  return idx;
}

export default function DailyStability({ orders, downtimes, maintenances }) {
  const [expanded, setExpanded] = useState(null);

  const downtimeIdx = buildIndex(downtimes || [], 'machine_id');
  const maintIdx = buildIndex(maintenances || [], 'machine_id');

  const byProductDate = {};
  orders.forEach(o => {
    if (!o.actual_quantity || !o.production_minutes) return;
    const name = o.product_type_name || 'Desconhecido';
    const date = (o.production_date || '').slice(0, 10);
    if (!date) return;
    if (!byProductDate[name]) byProductDate[name] = {};
    if (!byProductDate[name][date]) byProductDate[name][date] = { qty: 0, minutes: 0, machineIds: new Set() };
    byProductDate[name][date].qty += o.actual_quantity;
    byProductDate[name][date].minutes += o.production_minutes;
    if (o.machine_id) byProductDate[name][date].machineIds.add(o.machine_id);
  });

  const data = Object.entries(byProductDate).map(([name, dates]) => {
    const daily = Object.entries(dates).map(([date, d]) => {
      const productivity = d.minutes > 0 ? d.qty / (d.minutes / 60) : 0;
      // gather downtimes + maintenance for machines used that day
      let downtimeMin = 0;
      const catMap = {};
      d.machineIds.forEach(mid => {
        (downtimeIdx[date]?.[mid] || []).forEach(dt => {
          downtimeMin += dt.duration_minutes || 0;
          const cat = dt.failure_category || 'Outros';
          catMap[cat] = (catMap[cat] || 0) + (dt.duration_minutes || 0);
        });
      });
      let maintMin = 0;
      const maintTypeMap = {};
      d.machineIds.forEach(mid => {
        (maintIdx[date]?.[mid] || []).forEach(m => {
          maintMin += m.duration_minutes || 0;
          const t = m.maintenance_type || 'Outros';
          maintTypeMap[t] = (maintTypeMap[t] || 0) + (m.duration_minutes || 0);
        });
      });
      const topCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]).map(([c, m]) => `${c} (${m}min)`);
      const topMaint = Object.entries(maintTypeMap).sort((a, b) => b[1] - a[1]).map(([c, m]) => `${c} (${m}min)`);
      return { date, productivity, downtimeMin, maintMin, topCats, topMaint };
    }).sort((a, b) => a.date.localeCompare(b.date));

    const productivities = daily.map(d => d.productivity).filter(v => v > 0);
    const avg = productivities.length ? productivities.reduce((a, b) => a + b, 0) / productivities.length : 0;
    const sd = stdDev(productivities);
    const cv = avg > 0 ? (sd / avg) * 100 : 0;
    return {
      name,
      days: productivities.length,
      avg: parseFloat(avg.toFixed(1)),
      stdDev: parseFloat(sd.toFixed(1)),
      cv: parseFloat(cv.toFixed(1)),
      daily,
    };
  }).filter(d => d.days > 1).sort((a, b) => b.cv - a.cv);

  if (data.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground text-sm">
        Dados diários insuficientes (é preciso mais de um dia de produção por artefato).
      </div>
    );
  }

  const maxCv = Math.max(...data.map(d => d.cv), 1);

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wide">
            <th className="px-5 py-3 text-left font-semibold">Artefato</th>
            <th className="px-5 py-3 text-right font-semibold">Dias</th>
            <th className="px-5 py-3 text-right font-semibold">Média (un/h)</th>
            <th className="px-5 py-3 text-right font-semibold">Desvio Padrão (σ)</th>
            <th className="px-5 py-3 text-right font-semibold">Variação (CV)</th>
            <th className="px-5 py-3 text-left font-semibold w-40">Estabilidade</th>
            <th className="px-3 py-3 w-8" />
          </tr>
        </thead>
        <tbody>
          {data.map(d => {
            const c = stabilityColor(d.cv);
            const isOpen = expanded === d.name;
            return (
              <Fragment key={d.name}>
                <tr className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => setExpanded(isOpen ? null : d.name)}>
                  <td className="px-5 py-3 font-medium text-foreground">{d.name}</td>
                  <td className="px-5 py-3 text-right text-muted-foreground">{d.days}</td>
                  <td className="px-5 py-3 text-right">{d.avg.toLocaleString('pt-BR')} un/h</td>
                  <td className="px-5 py-3 text-right font-semibold text-foreground">±{d.stdDev.toLocaleString('pt-BR')}</td>
                  <td className={`px-5 py-3 text-right font-semibold ${c.text}`}>{d.cv.toFixed(1)}%</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${Math.min((d.cv / maxCv) * 100, 100)}%` }} />
                      </div>
                      <span className={`text-xs font-medium flex items-center gap-1 ${c.text}`}>
                        {d.cv <= 10 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {c.label}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </td>
                </tr>
                {isOpen && (
                  <tr className="bg-muted/20">
                    <td colSpan={7} className="px-5 py-4">
                      <p className="text-xs text-muted-foreground mb-3">
                        Detalhe diário — dias com produtividade fora da faixa ±1σ da média ({(d.avg - d.stdDev).toFixed(0)}–{(d.avg + d.stdDev).toFixed(0)} un/h) estão destacados.
                        Paradas e manutenções nas máquinas que produziram o artefato naquele dia são listadas como causa provável.
                      </p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-muted-foreground border-b border-border">
                              <th className="text-left font-medium py-2 pr-3">Data</th>
                              <th className="text-right font-medium py-2 pr-3">Prod. (un/h)</th>
                              <th className="text-right font-medium py-2 pr-3">Desvio</th>
                              <th className="text-right font-medium py-2 pr-3">Parada (min)</th>
                              <th className="text-right font-medium py-2 pr-3">Manut. (min)</th>
                              <th className="text-left font-medium py-2">Causa provável</th>
                            </tr>
                          </thead>
                          <tbody>
                            {d.daily.map(day => {
                              const dev = d.avg > 0 ? ((day.productivity - d.avg) / d.avg) * 100 : 0;
                              const outlier = Math.abs(day.productivity - d.avg) > d.stdDev;
                              const lowOutlier = day.productivity < d.avg - d.stdDev;
                              const cause = [];
                              if (lowOutlier && day.topCats.length > 0) cause.push({ icon: AlertTriangle, text: `Parada: ${day.topCats.join(', ')}`, color: 'text-red-600' });
                              if (lowOutlier && day.topMaint.length > 0) cause.push({ icon: Wrench, text: `Manutenção: ${day.topMaint.join(', ')}`, color: 'text-amber-600' });
                              if (lowOutlier && day.downtimeMin === 0 && day.maintMin === 0) cause.push({ icon: AlertTriangle, text: 'Sem paradas/manutenção registradas — verificar setup ou matéria-prima', color: 'text-muted-foreground' });
                              return (
                                <tr key={day.date} className={`border-b border-border/40 ${outlier ? (lowOutlier ? 'bg-red-50/50' : 'bg-green-50/40') : ''}`}>
                                  <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">{day.date}</td>
                                  <td className="py-2 pr-3 text-right font-medium text-foreground">{day.productivity.toFixed(0)}</td>
                                  <td className={`py-2 pr-3 text-right font-semibold ${dev > 0 ? 'text-green-600' : 'text-red-600'}`}>{dev > 0 ? '+' : ''}{dev.toFixed(1)}%</td>
                                  <td className="py-2 pr-3 text-right text-red-600">{day.downtimeMin > 0 ? `${day.downtimeMin}min` : '—'}</td>
                                  <td className="py-2 pr-3 text-right text-amber-600">{day.maintMin > 0 ? `${day.maintMin}min` : '—'}</td>
                                  <td className="py-2">
                                    {cause.length === 0 ? (
                                      <span className="text-muted-foreground">Dentro da faixa esperada</span>
                                    ) : (
                                      <div className="space-y-1">
                                        {cause.map((ca, i) => (
                                          <div key={i} className={`flex items-start gap-1.5 ${ca.color}`}>
                                            <ca.icon className="w-3 h-3 mt-0.5 shrink-0" />
                                            <span>{ca.text}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}