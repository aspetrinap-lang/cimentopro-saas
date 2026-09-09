import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Save, Plus, Trash2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import CalibrationTab from './CalibrationTab';
import {
  NORM_OPTIONS, AGE_PRESETS, TRAFFIC_TYPES,
  MIN_RESISTANCE_BY_TRAFFIC, MIN_THICKNESS_BY_TRAFFIC, DIMENSIONAL_TOLERANCE_MM,
  inferNorm, computeSpecimen, groupByAge, ageStats,
  checkThickness, buildAlerts, checkApproval, estimateFck,
} from '@/lib/qualityNorms';

// Resolve o fck de referência: usa o fck de projeto informado, ou a resistência
// mínima da NBR 9781 para o tipo de tráfego quando não houver fck de projeto.
function resolveTargetFck(form) {
  const target = Number(form.target_resistance) || 0;
  if (target > 0) return target;
  if (form.norm_reference === 'NBR 9781') {
    return MIN_RESISTANCE_BY_TRAFFIC[form.traffic_type] || 0;
  }
  return 0;
}

let specIdCounter = 1000;

function emptySpecimen(ageDays = 7) {
  return {
    id: ++specIdCounter,
    age_days: ageDays,
    width_mm: 0, height_mm: 0, length_mm: 0, area_cm2: 0, mass_g: 0,
    rupture_load_kn: 0, resistance_mpa: 0,
  };
}

export default function QualityReportForm({ order, productType, report, onClose, onSaved }) {
  const isPavimento = (form) => form.norm_reference === 'NBR 9781';

  const [form, setForm] = useState(() => {
    if (report) {
      const { specimens, average_resistance, min_resistance, ...rest } = report;
      return {
        specimen_count: report.specimens?.length || 6,
        final_age_days: report.final_age_days ?? 28,
        ...rest,
      };
    }
    return {
      report_number: '',
      order_id: order?.id || '',
      order_number: order?.order_number || '',
      product_type_id: productType?.id || '',
      product_type_name: productType?.name || order?.product_type_name || '',
      category: productType?.category || '',
      norm_reference: inferNorm(productType?.category),
      laboratory_name: '',
      test_equipment: 'Prensa PAVITEST 100 toneladas, acionamento hidráulico',
      calibration_number: '0212/26',
      calibration_date: '2026-07-02',
      calibration_issuer: 'Instruqual',
      responsible_engineer: '',
      engineer_crea: '',
      manufacturer: '',
      application_location: '',
      molding_date: order?.production_date || '',
      test_date: '',
      specimen_count: 6,
      final_age_days: 28,
      target_resistance: productType?.target_resistance || 0,
      norm_class: productType?.norm_class || '',
      traffic_type: 'Pedestres/Leves',
      nominal_thickness_mm: productType?.height_mm || 0,
      measured_thickness_mm: 0,
      thickness_ok: true,
      is_compliant: false,
      alerts: [],
      conclusion: '',
      notes: '',
      status: 'Emitido',
    };
  });

  const [specimens, setSpecimens] = useState(() => {
    if (report?.specimens?.length) return report.specimens.map(s => ({ ...s }));
    return Array.from({ length: 6 }, () => emptySpecimen(7));
  });
  const [loading, setLoading] = useState(false);
  const [existing, setExisting] = useState([]);
  const [existingLoaded, setExistingLoaded] = useState(false);
  const [activeAge, setActiveAge] = useState(7);

  useEffect(() => {
    base44.entities.QualityReport.list('-created_date', 500)
      .then(data => { setExisting(data); setExistingLoaded(true); })
      .catch(() => { setExistingLoaded(true); });
  }, []);

  useEffect(() => {
    // Só gera o número automático para laudos novos, após carregar os existentes
    if (!report && !form.report_number && existingLoaded) {
      const currentYear = new Date().getFullYear().toString().slice(-2);
      // Busca o maior sequencial do ano atual entre os laudos existentes
      const sameYear = existing
        .map(r => (r.report_number || '').match(/^(\d+)\/(\d+)$/))
        .filter(m => m && m[2] === currentYear)
        .map(m => parseInt(m[1], 10));
      const nextSeq = sameYear.length ? Math.max(...sameYear) + 1 : 1;
      setForm(f => ({ ...f, report_number: `${String(nextSeq).padStart(3, '0')}/${currentYear}` }));
    }
  }, [existing, form.report_number, existingLoaded, report]);

  const computedSpecimens = useMemo(() => specimens.map(s => computeSpecimen(s, form.norm_reference)), [specimens, form.norm_reference]);

  const groups = useMemo(() => groupByAge(computedSpecimens), [computedSpecimens]);
  const availableAges = useMemo(() => {
    const set = new Set(groups.map(g => g.age_days));
    AGE_PRESETS.forEach(a => set.add(a));
    return Array.from(set).sort((a, b) => a - b);
  }, [groups]);

  // Idade de referência: final_age_days (ou a maior idade ensaiada se não houver)
  const finalAge = useMemo(() => {
    const ages = groups.map(g => g.age_days);
    if (ages.includes(Number(form.final_age_days))) return Number(form.final_age_days);
    return ages.length ? Math.max(...ages) : 0;
  }, [groups, form.final_age_days]);

  const target = resolveTargetFck(form);
  const finalGroup = groups.find(g => g.age_days === finalAge) || { specimens: [] };
  const { average, min } = ageStats(finalGroup.specimens);
  const estimatedFck = useMemo(() => estimateFck(finalGroup.specimens), [finalGroup]);

  // Valores de exibição: refletem a idade selecionada (activeAge) nos cartões de resumo
  const displayGroup = useMemo(
    () => groups.find(g => g.age_days === activeAge) || { specimens: [] },
    [groups, activeAge]
  );
  const { average: displayAverage, min: displayMin } = ageStats(displayGroup.specimens);
  const displayEstimatedFck = useMemo(() => estimateFck(displayGroup.specimens), [displayGroup]);
  const displayApproval = checkApproval({ estimatedFck: displayEstimatedFck, target });

  const thicknessOk = checkThickness(form.nominal_thickness_mm, form.measured_thickness_mm);
  const hasFinalAge = groups.some(g => g.age_days === finalAge && g.specimens.some(s => s.resistance_mpa > 0));

  const alerts = buildAlerts({
    norm_reference: form.norm_reference,
    average, min, target,
    traffic_type: form.traffic_type,
    thickness_ok: thicknessOk,
    hasFinalAge,
  });

  // Critério de aprovação: fck,est ≥ fck especificado (APROVADO/ATENÇÃO/REPROVADO)
  const finalApproval = checkApproval({ estimatedFck, target });
  const compliant = finalApproval === 'APROVADO';

  useEffect(() => {
    setForm(f => ({
      ...f,
      is_compliant: compliant,
      average_resistance: +average.toFixed(2),
      min_resistance: +min.toFixed(2),
      estimated_fck: +estimatedFck.toFixed(2),
      thickness_ok: thicknessOk,
      alerts,
      final_age_days: finalAge,
    }));
  }, [compliant, average, min, estimatedFck, thicknessOk, alerts, finalAge]);

  function setField(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function updateSpec(idx, field, value) {
    setSpecimens(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  }

  function addSpecAtAge(age) {
    setSpecimens(prev => [...prev, emptySpecimen(age)]);
    setActiveAge(age);
  }

  function removeSpec(idx) {
    setSpecimens(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    const payload = {
      ...form,
      specimens: computedSpecimens,
      average_resistance: +average.toFixed(2),
      min_resistance: +min.toFixed(2),
      estimated_fck: +estimatedFck.toFixed(2),
      is_compliant: compliant,
      thickness_ok: thicknessOk,
      alerts,
      final_age_days: finalAge,
    };
    if (!payload.test_date && payload.molding_date) {
      const d = new Date(payload.molding_date + 'T00:00:00');
      d.setDate(d.getDate() + (payload.final_age_days || 28));
      payload.test_date = d.toISOString().slice(0, 10);
    }
    const targetLabel = Number(form.target_resistance) > 0
      ? `fck de ${target} MPa`
      : `resistência mínima de ${target} MPa (${payload.norm_reference} — tráfego ${payload.traffic_type})`;
    if (!estimatedFck || estimatedFck === 0) {
      payload.conclusion = `Laudo em fase de preenchimento — aguardando resultados do ensaio de compressão para avaliação da conformidade à norma ${payload.norm_reference}.`;
    } else {
      payload.conclusion = compliant
        ? `Lote CONFORME à norma ${payload.norm_reference}. fck estimado de ${estimatedFck.toFixed(2)} MPa na idade de ${finalAge} dias atende à ${targetLabel}.`
        : `Lote NÃO CONFORME à norma ${payload.norm_reference}. fck estimado de ${estimatedFck.toFixed(2)} MPa na idade de ${finalAge} dias não atende à ${targetLabel}.`;
    }
    try {
      if (report) {
        await base44.entities.QualityReport.update(report.id, payload);
      } else {
        await base44.entities.QualityReport.create(payload);
      }
      onSaved?.();
      onClose?.();
    } finally {
      setLoading(false);
    }
  }

  const pavimento = isPavimento(form);
  const minResist = MIN_RESISTANCE_BY_TRAFFIC[form.traffic_type];
  const minThick = MIN_THICKNESS_BY_TRAFFIC[form.traffic_type];
  const thicknessVariation = (form.nominal_thickness_mm != null && form.measured_thickness_mm != null)
    ? Math.abs(Number(form.measured_thickness_mm) - Number(form.nominal_thickness_mm))
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-card rounded-xl shadow-xl border border-border w-full max-w-5xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-bold text-foreground">{report ? 'Editar Laudo' : 'Novo Laudo de Resistência'}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Ordem {form.order_number} — {form.product_type_name}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <Tabs defaultValue="laudo" className="w-full">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="laudo">Dados do Laudo</TabsTrigger>
              <TabsTrigger value="calibracao">Equipamento &amp; Calibração</TabsTrigger>
            </TabsList>

            <TabsContent value="laudo" className="space-y-6 mt-4">
              {/* 1. Identificação */}
              <section>
                <h3 className="text-sm font-semibold text-foreground mb-3">1. Identificação do Laboratório e Responsável</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-3">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Laboratório</label>
                    <input className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                      value={form.laboratory_name} onChange={e => setField('laboratory_name', e.target.value)} placeholder="Nome do laboratório" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Engenheiro Responsável</label>
                    <input className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background" required
                      value={form.responsible_engineer} onChange={e => setField('responsible_engineer', e.target.value)} placeholder="Engº Civil" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">CREA</label>
                    <input className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background"
                      value={form.engineer_crea} onChange={e => setField('engineer_crea', e.target.value)} placeholder="CREA/UF" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Nº do Laudo</label>
                    <input className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-muted/40 text-muted-foreground font-mono" required
                      value={form.report_number} readOnly />
                  </div>
                </div>
              </section>

              {/* 2. Rastreabilidade */}
              <section>
                <h3 className="text-sm font-semibold text-foreground mb-3">2. Rastreabilidade do Lote</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Ordem de Produção</label>
                    <input className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-muted/40 text-muted-foreground" value={form.order_number} readOnly />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Artefato</label>
                    <input className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-muted/40 text-muted-foreground" value={form.product_type_name} readOnly />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Norma de Referência</label>
                    <select className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background"
                      value={form.norm_reference} onChange={e => setField('norm_reference', e.target.value)}>
                      {NORM_OPTIONS.map(n => <option key={n} value={n}>{n}{n === 'NBR 6136' ? ' (Blocos)' : ' (Pavimentos)'}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Fabricante</label>
                    <input className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background"
                      value={form.manufacturer} onChange={e => setField('manufacturer', e.target.value)} placeholder="Fabricante" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Data de Moldagem</label>
                    <input type="date" required className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background"
                      value={form.molding_date} onChange={e => setField('molding_date', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Idade de Referência (dias)</label>
                    <select className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background"
                      value={form.final_age_days} onChange={e => setField('final_age_days', Number(e.target.value))}>
                      {AGE_PRESETS.map(a => <option key={a} value={a}>{a} dias</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Local de Aplicação</label>
                    <input className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background"
                      value={form.application_location} onChange={e => setField('application_location', e.target.value)} placeholder="Obra / local" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Resistência Característica — fck (MPa)</label>
                    <input type="number" step="0.1" required className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background"
                      value={form.target_resistance} onChange={e => setField('target_resistance', parseFloat(e.target.value))} />
                  </div>
                </div>
              </section>

              {/* 2.5 — Campos específicos NBR 9781 (Pavimentos) */}
              {pavimento && (
                <section className="border border-amber-200 dark:border-amber-900 bg-amber-50/40 dark:bg-amber-950/20 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <h3 className="text-sm font-semibold text-foreground">Requisitos NBR 9781 — Pavimentos Intertravados</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Tipo de Tráfego</label>
                      <select className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background"
                        value={form.traffic_type} onChange={e => setField('traffic_type', e.target.value)}>
                        {TRAFFIC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <p className="text-xs text-muted-foreground mt-1">Resist. mínima: <strong>{minResist} MPa</strong> • Espessura mín.: <strong>{(minThick/10).toFixed(0)} cm</strong></p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Espessura Nominal (mm)</label>
                      <input type="number" step="0.1" className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background"
                        value={form.nominal_thickness_mm || ''} onChange={e => setField('nominal_thickness_mm', parseFloat(e.target.value))} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Espessura Medida (mm)</label>
                      <input type="number" step="0.1" className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background"
                        value={form.measured_thickness_mm || ''} onChange={e => setField('measured_thickness_mm', parseFloat(e.target.value))} />
                      <p className={`text-xs mt-1 ${thicknessOk ? 'text-green-600' : 'text-red-600'}`}>
                        Variação: {thicknessVariation.toFixed(1)} mm (tol. ±{DIMENSIONAL_TOLERANCE_MM} mm) — {thicknessOk ? 'OK' : 'FORA'}
                      </p>
                    </div>
                  </div>
                </section>
              )}

              {/* 3. Resultados por idade */}
              <section>
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <h3 className="text-sm font-semibold text-foreground">3. Resultados do Ensaio de Compressão por Idade</h3>
                  <div className="flex items-center gap-1 flex-wrap">
                    {availableAges.map(age => (
                      <button key={age} type="button"
                        onClick={() => setActiveAge(age)}
                        className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${activeAge === age ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}>
                        {age} dias
                      </button>
                    ))}
                    <button type="button" onClick={() => addSpecAtAge(activeAge)}
                      className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2.5 py-1.5 rounded-lg hover:bg-primary/20">
                      <Plus className="w-3 h-3" /> CP
                    </button>
                  </div>
                </div>

                {/* Resumo por idade */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                  {availableAges.map(age => {
                    const g = groups.find(gg => gg.age_days === age);
                    const stats = ageStats(g?.specimens || []);
                    const fckEst = estimateFck(g?.specimens || []);
                    const isFinal = age === finalAge;
                    const isLaudo = stats.average > 0;
                    return (
                      <div key={age} className={`rounded-lg p-2.5 border text-center ${isFinal ? 'bg-primary/5 border-primary/30' : 'bg-muted/40 border-border'}`}>
                        <p className="text-xs text-muted-foreground">
                          {age} dias {isFinal && <span className="text-primary font-medium">★ ref.</span>}
                          {isLaudo && <span className="ml-1 text-[9px] px-1 py-0.5 rounded bg-primary/10 text-primary">laudo</span>}
                        </p>
                        <p className="text-base font-bold text-foreground">{stats.average ? stats.average.toFixed(2) : '—'} <span className="text-xs font-normal text-muted-foreground">MPa</span></p>
                        <p className="text-[11px] text-muted-foreground">fck est: <strong className="text-foreground">{fckEst ? fckEst.toFixed(2) : '—'}</strong> MPa</p>
                        <p className="text-[10px] text-muted-foreground">{g?.specimens.length || 0} CP{stats.min ? ` • mín ${stats.min.toFixed(2)}` : ''}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Tabela da idade ativa */}
                <div className="overflow-x-auto border border-border rounded-lg">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 text-xs text-muted-foreground uppercase">
                        <th className="px-2 py-2 text-left">CP</th>
                        <th className="px-2 py-2 text-left">Idade (dias)</th>
                        <th className="px-2 py-2 text-left">Larg. (mm)</th>
                        <th className="px-2 py-2 text-left">Comp. (mm)</th>
                        <th className="px-2 py-2 text-left">Alt. (mm)</th>
                        <th className="px-2 py-2 text-left">Área (cm²)</th>
                        <th className="px-2 py-2 text-left">Massa (g)</th>
                        <th className="px-2 py-2 text-left">Carga (kN)</th>
                        <th className="px-2 py-2 text-left">Resist. (MPa)</th>
                        <th className="px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {computedSpecimens
                        .map((s, globalIdx) => ({ s, globalIdx }))
                        .filter(({ s }) => Number(s.age_days) === activeAge)
                        .map(({ s, globalIdx }) => (
                          <tr key={s.id} className="border-t border-border">
                            <td className="px-2 py-1.5 text-center font-medium">{s.id}</td>
                            <td className="px-1 py-1.5"><input type="number" className="w-16 px-2 py-1 border border-input rounded text-xs bg-background" value={s.age_days} onChange={e => updateSpec(globalIdx, 'age_days', parseInt(e.target.value) || 0)} /></td>
                            <td className="px-1 py-1.5"><input type="number" className="w-20 px-2 py-1 border border-input rounded text-xs bg-background" value={s.width_mm || ''} onChange={e => updateSpec(globalIdx, 'width_mm', parseFloat(e.target.value))} /></td>
                            <td className="px-1 py-1.5"><input type="number" className="w-20 px-2 py-1 border border-input rounded text-xs bg-background" value={s.length_mm || ''} onChange={e => updateSpec(globalIdx, 'length_mm', parseFloat(e.target.value))} /></td>
                            <td className="px-1 py-1.5"><input type="number" className="w-20 px-2 py-1 border border-input rounded text-xs bg-background" value={s.height_mm || ''} onChange={e => updateSpec(globalIdx, 'height_mm', parseFloat(e.target.value))} /></td>
                            <td className="px-2 py-1.5 text-muted-foreground">{s.area_cm2}</td>
                            <td className="px-1 py-1.5"><input type="number" step="0.1" className="w-20 px-2 py-1 border border-input rounded text-xs bg-background" value={s.mass_g || ''} onChange={e => updateSpec(globalIdx, 'mass_g', parseFloat(e.target.value))} /></td>
                            <td className="px-1 py-1.5"><input type="number" step="0.1" className="w-24 px-2 py-1 border border-input rounded text-xs bg-background" value={s.rupture_load_kn || ''} onChange={e => updateSpec(globalIdx, 'rupture_load_kn', parseFloat(e.target.value))} /></td>
                            <td className="px-2 py-1.5 font-semibold text-foreground">{s.resistance_mpa}</td>
                            <td className="px-1 py-1.5 text-center">
                              <button type="button" onClick={() => removeSpec(globalIdx)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                            </td>
                          </tr>
                        ))}
                      {computedSpecimens.filter(s => Number(s.age_days) === activeAge).length === 0 && (
                        <tr><td colSpan={10} className="px-2 py-6 text-center text-xs text-muted-foreground">Nenhum corpo de prova aos {activeAge} dias. Clique em "+ CP" para adicionar.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Resumo + alertas */}
              <section className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="bg-muted/40 rounded-lg p-3 border border-border text-center">
                    <p className="text-xs text-muted-foreground">Resistência Média ({activeAge}d)</p>
                    <p className="text-xl font-bold text-foreground">{displayAverage.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">MPa</p>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-3 border border-border text-center">
                    <p className="text-xs text-muted-foreground">Menor Individual</p>
                    <p className="text-xl font-bold text-foreground">{displayMin.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">MPa</p>
                  </div>
                  <div className="bg-primary/5 rounded-lg p-3 border border-primary/30 text-center">
                    <p className="text-xs text-muted-foreground">fck Estimado</p>
                    <p className="text-xl font-bold text-primary">{displayEstimatedFck ? displayEstimatedFck.toFixed(2) : '—'}</p>
                    <p className="text-xs text-muted-foreground">MPa</p>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-3 border border-border text-center">
                    <p className="text-xs text-muted-foreground">fck Projeto</p>
                    <p className="text-xl font-bold text-foreground">{target || '—'}</p>
                    <p className="text-xs text-muted-foreground">MPa</p>
                  </div>
                  <div className={`rounded-lg p-3 border text-center ${
                    displayApproval === 'APROVADO' ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900'
                    : displayApproval === 'ATENÇÃO' ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900'
                    : displayApproval === 'REPROVADO' ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900'
                    : 'bg-muted/40 border-border'
                  }`}>
                    <p className="text-xs text-muted-foreground">Aprovação ({activeAge}d)</p>
                    <p className={`text-lg font-bold flex items-center justify-center gap-1 ${
                      displayApproval === 'APROVADO' ? 'text-green-700 dark:text-green-400'
                      : displayApproval === 'ATENÇÃO' ? 'text-amber-700 dark:text-amber-400'
                      : displayApproval === 'REPROVADO' ? 'text-red-700 dark:text-red-400'
                      : 'text-muted-foreground'
                    }`}>
                      {displayApproval === 'APROVADO' && <><CheckCircle2 className="w-5 h-5" /> APROVADO</>}
                      {displayApproval === 'ATENÇÃO' && <><AlertTriangle className="w-5 h-5" /> ATENÇÃO</>}
                      {displayApproval === 'REPROVADO' && <><XCircle className="w-5 h-5" /> REPROVADO</>}
                      {displayApproval === null && '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">fck,est {displayEstimatedFck ? displayEstimatedFck.toFixed(2) : '—'} / fck {target || '—'} MPa</p>
                  </div>
                </div>

                {alerts.length > 0 && (
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-3 space-y-1.5">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-xs font-semibold">
                      <AlertTriangle className="w-4 h-4" /> Alertas (informativos — não bloqueiam a emissão)
                    </div>
                    {alerts.map((a, i) => (
                      <p key={i} className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
                        <span className="mt-0.5">•</span>{a}
                      </p>
                    ))}
                  </div>
                )}
              </section>

              {/* Conclusão */}
              <section>
                <h3 className="text-sm font-semibold text-foreground mb-3">4. Conclusão Técnica</h3>
                <textarea className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background min-h-[80px]"
                  value={form.conclusion} onChange={e => setField('conclusion', e.target.value)}
                  placeholder="Conclusão sobre a conformidade do lote..." />
                <div className="mt-3">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Observações</label>
                  <textarea className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background min-h-[50px]"
                    value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="Observações adicionais..." />
                </div>
              </section>
            </TabsContent>

            <TabsContent value="calibracao" className="mt-4">
              <CalibrationTab form={form} setField={setField} />
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-border text-muted-foreground hover:bg-muted">Cancelar</button>
            <button type="submit" disabled={loading} className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
              <Save className="w-4 h-4" /> {loading ? 'Salvando...' : 'Salvar Laudo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}