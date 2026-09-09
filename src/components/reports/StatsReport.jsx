import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useInsumoNames } from '@/hooks/useInsumoNames';
import { useInsumoCosts } from '@/hooks/useInsumoCosts';
import { Activity } from 'lucide-react';
import ReportSheet from './ReportSheet';
import Section from './Section';
import { INSUMO_KEYS, INSUMO_FIELDS } from '@/lib/insumos';
import {
  computeStats, iecFromCV, iecStatus, fmtNum, fmtBRL,
  theoreticalForOrder, classifyDeviation,
} from '@/lib/statsUtils';
import { inRange } from '@/lib/reportUtils';

const cvStatus = (cv) => {
  if (cv == null || !isFinite(cv)) return { label: '—', emoji: '⚪' };
  if (cv <= 2) return { label: 'Estável', emoji: '🟢' };
  if (cv <= 5) return { label: 'Atenção', emoji: '🟡' };
  if (cv <= 10) return { label: 'Alerta', emoji: '🟠' };
  return { label: 'Instável', emoji: '🔴' };
};

const Th = ({ children, right }) => (
  <th className={`py-1.5 font-semibold ${right ? 'text-right' : 'text-left'}`}>{children}</th>
);

// Ficha técnica do Controle Estatístico: todos os indicadores da página em
// formato A4 — IEC, estatísticas por matéria-prima, controle de limites,
// comparação entre máquinas e rankings.
export default function StatsReport({ onClose }) {
  const [data, setData] = useState(null);
  const { names } = useInsumoNames();
  const { costs } = useInsumoCosts();

  useEffect(() => {
    Promise.all([
      base44.entities.ProductionOrder.filter({ status: 'Concluída' }, '-production_date', 1000),
      base44.entities.ProductType.list('name'),
      base44.entities.ConcreteTrace.list('name'),
    ]).then(([orders, productTypes, traces]) => {
      setData({
        orders,
        ptMap: Object.fromEntries(productTypes.map((p) => [p.id, p])),
        traceMap: Object.fromEntries(traces.map((t) => [t.id, t])),
      });
    });
  }, []);

  return (
    <ReportSheet
      title="Ficha Técnica — Controle Estatístico"
      subtitle="Indicadores estatísticos, controle de limites, comparação entre máquinas e rankings"
      icon={Activity}
      onClose={onClose}
    >
      {({ start, end }) =>
        !data ? (
          <p className="text-sm text-slate-500 text-center py-10">Carregando dados do período...</p>
        ) : (
          <Content
            orders={data.orders} ptMap={data.ptMap} traceMap={data.traceMap}
            names={names} costs={costs} start={start} end={end}
          />
        )
      }
    </ReportSheet>
  );
}

function Content({ orders, ptMap, traceMap, names, costs, start, end }) {
  const filtered = useMemo(
    () => orders.filter((o) => inRange(o.production_date, start, end) && (Number(o.actual_quantity) || 0) > 0),
    [orders, start, end]
  );

  // IEC — mesmo critério da página: CV calculado por artefato + insumo,
  // agrupado por insumo e depois média geral
  const { iec, avgCV } = useMemo(() => {
    const byProduct = {};
    filtered.forEach((o) => {
      const name = o.product_type_name || 'Desconhecido';
      if (!byProduct[name]) byProduct[name] = {};
      INSUMO_KEYS.forEach((key) => {
        const v = Number(o[INSUMO_FIELDS[key].actual]) || 0;
        if (v > 0) (byProduct[name][key] ||= []).push(v / o.actual_quantity);
      });
    });
    const byInsumo = {};
    Object.values(byProduct).forEach((prods) => {
      INSUMO_KEYS.forEach((key) => {
        const s = computeStats(prods[key]);
        if (s && isFinite(s.cv)) (byInsumo[key] ||= []).push(s.cv);
      });
    });
    const cvs = [];
    INSUMO_KEYS.forEach((key) => {
      const arr = byInsumo[key];
      if (arr?.length) cvs.push(arr.reduce((a, b) => a + b, 0) / arr.length);
    });
    const avg = cvs.length ? cvs.reduce((a, b) => a + b, 0) / cvs.length : null;
    return { iec: iecFromCV(avg), avgCV: avg };
  }, [filtered]);

  // Indicadores completos por matéria-prima (mesma tabela da página)
  const insumoRows = useMemo(
    () =>
      INSUMO_KEYS.map((key) => {
        const { actual, unit } = INSUMO_FIELDS[key];
        const vals = filtered
          .map((o) => (Number(o[actual]) || 0) > 0 ? o[actual] / o.actual_quantity : null)
          .filter(Boolean);
        const s = computeStats(vals);
        return s ? { key, label: names[key] || key, unit, s } : null;
      }).filter(Boolean),
    [filtered, names]
  );

  // Controle de limites: real vs. ficha técnica (traço)
  const limitRows = useMemo(
    () =>
      INSUMO_KEYS.map((key) => {
        const { actual, unit } = INSUMO_FIELDS[key];
        let sumRealPU = 0, sumTheoPU = 0, totalQty = 0, n = 0;
        filtered.forEach((o) => {
          const real = Number(o[actual]) || 0;
          const theo = theoreticalForOrder(o, key, ptMap, traceMap);
          if (real <= 0 && theo <= 0) return;
          n += 1;
          sumRealPU += real / o.actual_quantity;
          sumTheoPU += theo > 0 ? theo / o.actual_quantity : 0;
          totalQty += o.actual_quantity;
        });
        if (n === 0) return null;
        const realPU = sumRealPU / n;
        const theoPU = sumTheoPU / n;
        const devPct = theoPU > 0 ? ((realPU - theoPU) / theoPU) * 100 : null;
        const excessKg = devPct != null && devPct > 0 ? (realPU - theoPU) * totalQty : 0;
        const excessCost = excessKg * (costs[key] || 0);
        return { key, label: names[key] || key, unit, realPU, theoPU, devPct, excessKg, excessCost, n, cls: classifyDeviation(devPct) };
      }).filter(Boolean),
    [filtered, ptMap, traceMap, names, costs]
  );

  // Comparação entre máquinas: consumo médio/un por insumo + CV médio
  const machineRows = useMemo(() => {
    const map = {};
    filtered.forEach((o) => {
      const m = o.machine_name || 'Sem máquina';
      if (!map[m]) { map[m] = { name: m, n: 0, cvs: [] }; INSUMO_KEYS.forEach((k) => { map[m][k] = []; }); }
      map[m].n += 1;
      INSUMO_KEYS.forEach((k) => {
        const v = (Number(o[INSUMO_FIELDS[k].actual]) || 0) / o.actual_quantity;
        if (v > 0) map[m][k].push(v);
      });
    });
    return Object.values(map).map((m) => {
      const row = { name: m.name, n: m.n, means: {} };
      let totalCV = 0, cnt = 0;
      INSUMO_KEYS.forEach((k) => {
        const s = computeStats(m[k]);
        row.means[k] = s ? s.mean : null;
        if (s) { totalCV += s.cv; cnt += 1; }
      });
      row.avgCV = cnt ? totalCV / cnt : null;
      return row;
    });
  }, [filtered]);

  // Rankings (mesmos critérios da página)
  const rankings = useMemo(() => {
    const byProduct = {};
    const byMachine = {};
    const lots = [];
    filtered.forEach((o) => {
      const qty = o.actual_quantity;
      const pname = o.product_type_name || 'Desconhecido';
      const mname = o.machine_name || 'Sem máquina';
      if (!byProduct[pname]) {
        byProduct[pname] = { name: pname, perUnitSum: 0, n: 0, cvs: [] };
        INSUMO_KEYS.forEach((k) => { byProduct[pname][k] = []; });
      }
      byProduct[pname].n += 1;
      let totalPerUnit = 0;
      INSUMO_KEYS.forEach((k) => {
        const v = (Number(o[INSUMO_FIELDS[k].actual]) || 0) / qty;
        if (v > 0) { byProduct[pname][k].push(v); totalPerUnit += v * (costs[k] || 0); }
      });
      byProduct[pname].perUnitSum += totalPerUnit;

      if (!byMachine[mname]) byMachine[mname] = { name: mname, n: 0, devs: [] };
      byMachine[mname].n += 1;
      let sumTheo = 0, sumReal = 0;
      INSUMO_KEYS.forEach((k) => {
        sumReal += Number(o[INSUMO_FIELDS[k].actual]) || 0;
        sumTheo += theoreticalForOrder(o, k, ptMap, traceMap);
      });
      if (sumTheo > 0) byMachine[mname].devs.push(((sumReal - sumTheo) / sumTheo) * 100);

      let excessCost = 0;
      INSUMO_KEYS.forEach((k) => {
        const real = Number(o[INSUMO_FIELDS[k].actual]) || 0;
        const theo = theoreticalForOrder(o, k, ptMap, traceMap);
        if (theo > 0 && real > theo) excessCost += (real - theo) * (costs[k] || 0);
      });
      if (excessCost > 0) {
        lots.push({
          label: `${o.order_number || pname} — ${o.production_date?.slice(8, 10)}/${o.production_date?.slice(5, 7)}`,
          cost: excessCost,
        });
      }
    });

    const products = Object.values(byProduct).map((p) => {
      const cvs = [];
      INSUMO_KEYS.forEach((k) => { const s = computeStats(p[k]); if (s && s.count >= 2) cvs.push(s.cv); });
      return {
        name: p.name,
        avgCostPerUnit: p.n ? p.perUnitSum / p.n : 0,
        avgCV: cvs.length ? cvs.reduce((a, b) => a + b, 0) / cvs.length : null,
      };
    });
    const machines = Object.values(byMachine).map((m) => {
      const s = computeStats(m.devs);
      return { name: m.name, avgDev: s ? s.mean : 0 };
    });

    return {
      topConsumers: [...products].sort((a, b) => b.avgCostPerUnit - a.avgCostPerUnit).slice(0, 5),
      mostStable: [...products].filter((p) => p.avgCV != null).sort((a, b) => a.avgCV - b.avgCV).slice(0, 5),
      topMachineDev: machines.sort((a, b) => Math.abs(b.avgDev) - Math.abs(a.avgDev)).slice(0, 5),
      worstLots: [...lots].sort((a, b) => b.cost - a.cost).slice(0, 5),
    };
  }, [filtered, ptMap, traceMap, costs]);

  const st = iecStatus(iec);

  const RankList = ({ items, render, emptyText }) => (
    <table className="w-full text-xs border-collapse">
      <tbody>
        {items.length === 0 ? (
          <tr><td className="py-2 text-slate-500">{emptyText}</td></tr>
        ) : items.map((it, i) => (
          <tr key={i} className="border-b border-slate-200 last:border-0">
            <td className="py-1.5 w-6 text-slate-400 font-semibold">{i + 1}º</td>
            <td className="py-1.5 font-medium text-slate-900">{it.name || it.label}</td>
            <td className="py-1.5 text-right font-semibold text-slate-700">{render(it)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <>
      <Section title="Resumo estatístico">
        <p className="text-xs text-slate-600 leading-relaxed">
          Foram analisados <strong>{filtered.length} lote(s)</strong> de produção concluídos no período. O Índice de
          Estabilidade de Consumo (IEC) é <strong>{iec ?? '—'}</strong> — <strong>{st.label}</strong>, com CV médio de{' '}
          <strong>{avgCV != null ? `${fmtNum(avgCV, 2)}%` : '—'}</strong>. Quanto mais próximo de 100, mais constante é
          o consumo de matéria-prima por peça em toda a fábrica.
        </p>
      </Section>

      <Section title="Indicadores estatísticos por matéria-prima (consumo por unidade)">
        {insumoRows.length === 0 ? (
          <p className="text-xs text-slate-500">Nenhuma ordem com consumo registrado no período.</p>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-300">
                <Th>Insumo</Th>
                <Th right>Média</Th>
                <Th right>Desvio padrão</Th>
                <Th right>Variância</Th>
                <Th right>CV (%)</Th>
                <Th right>Mín.</Th>
                <Th right>Máx.</Th>
                <Th right>Mediana</Th>
                <Th right>Lotes</Th>
              </tr>
            </thead>
            <tbody>
              {insumoRows.map((r) => (
                <tr key={r.key} className="border-b border-slate-200">
                  <td className="py-1.5 font-medium text-slate-900">{r.label}</td>
                  <td className="py-1.5 text-right">{fmtNum(r.s.mean, 4)} {r.unit}/un</td>
                  <td className="py-1.5 text-right">{fmtNum(r.s.stdDev, 4)}</td>
                  <td className="py-1.5 text-right">{fmtNum(r.s.variance, 4)}</td>
                  <td className="py-1.5 text-right font-semibold">{fmtNum(r.s.cv, 2)}%</td>
                  <td className="py-1.5 text-right">{fmtNum(r.s.min, 4)}</td>
                  <td className="py-1.5 text-right">{fmtNum(r.s.max, 4)}</td>
                  <td className="py-1.5 text-right">{fmtNum(r.s.median, 4)}</td>
                  <td className="py-1.5 text-right">{r.s.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Controle de limites — real vs. ficha técnica (traço)">
        {limitRows.length === 0 ? (
          <p className="text-xs text-slate-500">Vincule traços de concreto aos artefatos para comparar consumo real vs. ficha técnica.</p>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-300">
                <Th>Insumo</Th>
                <Th right>Meta (traço/un)</Th>
                <Th right>Real médio/un</Th>
                <Th right>Desvio %</Th>
                <Th right>Excesso</Th>
                <Th right>Custo do excesso</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {limitRows.map((r) => (
                <tr key={r.key} className="border-b border-slate-200">
                  <td className="py-1.5 font-medium text-slate-900">{r.label}</td>
                  <td className="py-1.5 text-right">{r.theoPU > 0 ? `${fmtNum(r.theoPU, 4)} ${r.unit}` : '—'}</td>
                  <td className="py-1.5 text-right">{fmtNum(r.realPU, 4)} {r.unit}</td>
                  <td className="py-1.5 text-right font-semibold">
                    {r.devPct != null ? `${r.devPct > 0 ? '+' : ''}${fmtNum(r.devPct, 2)}%` : '—'}
                  </td>
                  <td className="py-1.5 text-right">{r.excessKg > 0 ? `${fmtNum(r.excessKg, 1)} ${r.unit === 'L' ? 'L' : 'kg'}` : '—'}</td>
                  <td className="py-1.5 text-right">{r.excessCost > 0 ? fmtBRL(r.excessCost) : '—'}</td>
                  <td className="py-1.5">{r.cls.emoji} {r.cls.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Comparação entre máquinas — consumo médio por unidade">
        {machineRows.length === 0 ? (
          <p className="text-xs text-slate-500">Nenhuma ordem com máquina vinculada no período.</p>
        ) : (
          <table className="w-full text-[10px] border-collapse">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-300">
                <Th>Máquina</Th>
                <Th right>Lotes</Th>
                {INSUMO_KEYS.map((key) => (
                  <Th key={key} right>{names[key]}</Th>
                ))}
                <Th right>CV médio</Th>
              </tr>
            </thead>
            <tbody>
              {machineRows.map((m) => (
                <tr key={m.name} className="border-b border-slate-200">
                  <td className="py-1.5 font-medium text-slate-900">{m.name}</td>
                  <td className="py-1.5 text-right">{m.n}</td>
                  {INSUMO_KEYS.map((key) => (
                    <td key={key} className="py-1.5 text-right">{m.means[key] != null ? fmtNum(m.means[key], 3) : '—'}</td>
                  ))}
                  <td className="py-1.5 text-right font-semibold">{m.avgCV != null ? `${fmtNum(m.avgCV, 1)}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Rankings do período">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">Produtos com maior custo/un</p>
            <RankList items={rankings.topConsumers} render={(it) => fmtBRL(it.avgCostPerUnit)} emptyText="Sem dados" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">Produtos mais estáveis (menor CV)</p>
            <RankList items={rankings.mostStable} render={(it) => (it.avgCV != null ? `${fmtNum(it.avgCV, 2)}%` : '—')} emptyText="Sem dados" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">Máquinas com maior desvio vs. traço</p>
            <RankList items={rankings.topMachineDev} render={(it) => `${it.avgDev > 0 ? '+' : ''}${fmtNum(it.avgDev, 1)}%`} emptyText="Sem traços vinculados" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">Lotes com maior desperdício</p>
            <RankList items={rankings.worstLots} render={(it) => fmtBRL(it.cost)} emptyText="Nenhum excesso registrado" />
          </div>
        </div>
      </Section>

      <Section title="Como ler esta ficha">
        <p className="text-xs text-slate-600 leading-relaxed">
          O <strong>CV (coeficiente de variação)</strong> mede o quanto o consumo por peça varia entre um lote e outro:
          até 2% é estável 🟢, de 2% a 5% merece atenção 🟡, de 5% a 10% é alerta 🟠 e acima de 10% o processo está
          instável 🔴 (calibração de dosagem, traço ou operação irregular). O <strong>IEC</strong> resume toda a fábrica.
          No <strong>controle de limites</strong>, o consumo real é comparado à ficha técnica (traço): desvios até 2%
          estão dentro da meta 🟢, de 2% a 5% são atenção 🟡, de 5% a 10% alerta 🟠 e acima de 10% críticos 🔴, com o
          custo do excesso estimado pelos preços dos insumos.
        </p>
      </Section>
    </>
  );
}