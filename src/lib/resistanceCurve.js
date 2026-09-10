import { estimateFck } from '@/lib/qualityNorms';

// Agrega os corpos de prova dos laudos por idade (7/14/21/28 dias):
// resistência média, fck estimado e nº de corpos de prova por idade.
export function aggregateAges(reports) {
  const byAge = {};
  (reports || []).forEach(r => (r.specimens || []).forEach(sp => {
    const age = Number(sp.age_days) || 0;
    const res = Number(sp.resistance_mpa) || 0;
    if (!age || !res) return;
    (byAge[age] = byAge[age] || []).push({ resistance_mpa: res });
  }));
  return Object.entries(byAge)
    .map(([age, specs]) => ({
      age_days: Number(age),
      average: +(specs.reduce((s, x) => s + x.resistance_mpa, 0) / specs.length).toFixed(2),
      fck_est: +estimateFck(specs).toFixed(2),
      count: specs.length,
    }))
    .sort((a, b) => a.age_days - b.age_days);
}

// Leitura técnica da curva: ganho 7→28 dias, estagnação/queda entre idades
// consecutivas e atingimento do fck alvo.
export function growthReading(rows, target, reportCount) {
  if (!rows || rows.length === 0) {
    return 'Nenhum corpo de prova com resultados de resistência para o filtro selecionado.';
  }
  const avgAt = (age) => {
    const r = rows.find(r => r.age_days === age);
    return r ? r.average : null;
  };
  const parts = [];
  const a7 = avgAt(7);
  const a28 = avgAt(28);
  if (a7 != null && a28 != null) {
    const gain = ((a28 / a7) - 1) * 100;
    if (gain < 15) {
      parts.push(`Ganho 7→28 dias baixo: ${gain.toFixed(1)}% (de ${a7.toFixed(2)} para ${a28.toFixed(2)} MPa) — evolução abaixo do esperado, que tipicamente supera 40% nesse intervalo; investigar traço, cura e condições de moldagem.`);
    } else if (gain < 40) {
      parts.push(`Ganho 7→28 dias moderado: ${gain.toFixed(1)}% (de ${a7.toFixed(2)} para ${a28.toFixed(2)} MPa).`);
    } else {
      parts.push(`Ganho 7→28 dias saudável: ${gain.toFixed(1)}% (de ${a7.toFixed(2)} para ${a28.toFixed(2)} MPa).`);
    }
  }
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1];
    const cur = rows[i];
    const delta = cur.average - prev.average;
    if (delta <= 0) {
      parts.push(`Estagnação/queda entre ${prev.age_days} e ${cur.age_days} dias: ${prev.average.toFixed(2)} → ${cur.average.toFixed(2)} MPa (${delta.toFixed(2)} MPa) — investigar cura, traço ou condições de ensaio.`);
    }
  }
  if (target > 0) {
    const r28 = rows.find(r => r.age_days === 28);
    if (r28) {
      const pct = (r28.fck_est / target) * 100;
      parts.push(`Aos 28 dias, fck estimado de ${r28.fck_est.toFixed(2)} MPa (${pct.toFixed(0)}% do alvo de ${target.toFixed(1)} MPa), com ${r28.count} corpos de prova.`);
    }
  }
  if (reportCount) parts.push(`Base: ${reportCount} laudo(s) no filtro selecionado.`);
  return parts.join(' ');
}