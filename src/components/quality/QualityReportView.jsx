import { useState } from 'react';
import { Printer, Pencil, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  MIN_RESISTANCE_BY_TRAFFIC, MIN_THICKNESS_BY_TRAFFIC, DIMENSIONAL_TOLERANCE_MM,
  groupByAge, ageStats, estimateFck, checkCompliance, buildAlerts,
} from '@/lib/qualityNorms';

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
}

function ruptureDate(moldingDate, ageDays) {
  if (!moldingDate) return null;
  const d = new Date(moldingDate + 'T00:00:00');
  d.setDate(d.getDate() + (Number(ageDays) || 0));
  return d.toISOString().split('T')[0];
}

function ageRowData(report, group) {
  const validSpecs = group.specimens.filter(s => Number(s.resistance_mpa) > 0);
  const stats = ageStats(group.specimens);
  const estFck = estimateFck(group.specimens);
  const target = Number(report.target_resistance) || 0;
  const compliant = validSpecs.length >= 3 ? checkCompliance({ average: stats.average, min: stats.min, target }) : null;
  return {
    age_days: group.age_days,
    rupture_date: ruptureDate(report.molding_date, group.age_days),
    cp_count: validSpecs.length,
    average: stats.average,
    min: stats.min,
    estimated_fck: estFck,
    target,
    compliant,
  };
}

export default function QualityReportView({ report, onClose, onEdit }) {
  const pavimento = report.norm_reference === 'NBR 9781';
  const groups = groupByAge(report.specimens || []);
  const rows = groups.map(g => ageRowData(report, g));
  const finalAge = report.final_age_days || (groups.length ? Math.max(...groups.map(g => g.age_days)) : 0);
  const compliant = report.is_compliant;
  const alerts = report.alerts || [];

  // Idade selecionada para impressão — default: idade de referência ou a primeira com resultados
  const [printAge, setPrintAge] = useState(() => {
    if (groups.length === 0) return 0;
    const refGroup = groups.find(g => g.age_days === finalAge);
    return refGroup ? refGroup.age_days : groups[0].age_days;
  });
  const thicknessVariation = (report.nominal_thickness_mm != null && report.measured_thickness_mm != null)
    ? Math.abs(Number(report.measured_thickness_mm) - Number(report.nominal_thickness_mm))
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white text-slate-900 rounded-xl shadow-xl border border-slate-200 w-full max-w-4xl max-h-[92vh] overflow-y-auto print:max-w-none print:shadow-none print:border-none print:rounded-none print:max-h-none print:overflow-visible print:p-0 print-area">
        {/* Toolbar */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between print:hidden">
          <h2 className="text-sm font-semibold">Laudo {report.report_number}</h2>
          <div className="flex items-center gap-2 flex-wrap">
            {groups.length > 0 && (
              <div className="flex items-center gap-1 mr-2">
                <span className="text-xs text-slate-500 mr-1">Idade:</span>
                {groups.map(g => (
                  <button key={g.age_days} onClick={() => setPrintAge(g.age_days)}
                    className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${printAge === g.age_days ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300 text-slate-700 hover:bg-slate-100'}`}>
                    {g.age_days}d
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => window.print()} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100">
              <Printer className="w-3.5 h-3.5" /> Imprimir {printAge}d
            </button>
            <button onClick={onEdit} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100">
              <Pencil className="w-3.5 h-3.5" /> Editar
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
          </div>
        </div>

        {/* ===== Screen view ===== */}
        <div className="p-8 space-y-6 print:hidden">
          {/* Cabeçalho */}
          <div className="border-b-2 border-slate-900 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl font-bold tracking-tight">
                  LAUDO TÉCNICO DE ENSAIO DE COMPRESSÃO AXIAL
                </h1>
                <p className="text-sm text-slate-600 mt-1">
                  Norma de referência: <strong>{report.norm_reference}</strong>
                  {pavimento ? ' — Pavimentos Intertravados de Concreto' : ' — Blocos Vazados de Concreto'}
                </p>
              </div>
              <div className="text-right text-sm">
                <p>Nº: <strong>{report.report_number}</strong></p>
                <p className="text-slate-600">{fmtDate(report.test_date)}</p>
              </div>
            </div>
          </div>

          {/* Laboratório */}
          <section className="grid grid-cols-2 gap-4 text-sm">
            <Info label="Laboratório" value={report.laboratory_name} />
            <Info label="Responsável Técnico" value={`${report.responsible_engineer || '—'}${report.engineer_crea ? ` — CREA ${report.engineer_crea}` : ''}`} />
          </section>

          {/* Equipamento de Ensaio */}
          <section>
            <h2 className="text-sm font-bold uppercase text-slate-700 border-b border-slate-200 pb-1 mb-3">Equipamento de Ensaio e Calibração</h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <Info label="Máquina de Ensaio" value={report.test_equipment} />
              <Info label="Calibração Nº" value={report.calibration_number} />
              <Info label="Data da Calibração" value={fmtDate(report.calibration_date)} />
              <Info label="Emitente" value={report.calibration_issuer} />
            </div>
          </section>

          {/* Rastreabilidade */}
          <section>
            <h2 className="text-sm font-bold uppercase text-slate-700 border-b border-slate-200 pb-1 mb-3">Rastreabilidade do Lote</h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <Info label="Ordem de Produção" value={report.order_number} />
              <Info label="Artefato" value={report.product_type_name} />
              <Info label="Categoria" value={report.category} />
              <Info label="Norma" value={report.norm_reference} />
              <Info label="Fabricante" value={report.manufacturer} />
              <Info label="Local de Aplicação" value={report.application_location} />
              <Info label="Data de Moldagem" value={fmtDate(report.molding_date)} />
              <Info label="Idade de Referência" value={`${finalAge} dias`} />
              <Info label="fck de Projeto" value={report.target_resistance ? `${report.target_resistance} MPa` : '—'} />
            </div>
          </section>

          {/* Requisitos NBR 9781 */}
          {pavimento && (
            <section>
              <h2 className="text-sm font-bold uppercase text-slate-700 border-b border-slate-200 pb-1 mb-3">Verificação Dimensional — NBR 9781</h2>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <Info label="Tipo de Tráfego" value={report.traffic_type} />
                <Info label="Resist. Mínima (norma)" value={`${MIN_RESISTANCE_BY_TRAFFIC[report.traffic_type] || '—'} MPa`} />
                <Info label="Espessura Mínima (norma)" value={`${(MIN_THICKNESS_BY_TRAFFIC[report.traffic_type] || 0) / 10} cm`} />
                <Info label="Espessura Nominal" value={report.nominal_thickness_mm ? `${report.nominal_thickness_mm} mm` : '—'} />
                <Info label="Espessura Medida" value={report.measured_thickness_mm ? `${report.measured_thickness_mm} mm` : '—'} />
                <div>
                  <p className="text-xs text-slate-500">Variação (tol. ±{DIMENSIONAL_TOLERANCE_MM} mm)</p>
                  <p className="font-medium flex items-center gap-1.5">
                    {thicknessVariation != null ? `${thicknessVariation.toFixed(1)} mm` : '—'}
                    {report.thickness_ok === false && (
                      <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                        <AlertTriangle className="w-3 h-3" /> Fora
                      </span>
                    )}
                    {report.thickness_ok === true && thicknessVariation != null && (
                      <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                        <CheckCircle2 className="w-3 h-3" /> OK
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* Resumo por idade — tabela */}
          <section>
            <h2 className="text-sm font-bold uppercase text-slate-700 border-b border-slate-200 pb-1 mb-3">
              Resumo por Idade de Rompimento
            </h2>
            {rows.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum corpo de prova registrado.</p>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-xs uppercase text-slate-500">
                    <th className="border border-slate-200 px-3 py-2 text-left">Idade (dias)</th>
                    <th className="border border-slate-200 px-3 py-2 text-left">Data de Rompimento</th>
                    <th className="border border-slate-200 px-3 py-2 text-center">Nº de CPs</th>
                    <th className="border border-slate-200 px-3 py-2 text-right">Resistência Média (MPa)</th>
                    <th className="border border-slate-200 px-3 py-2 text-right">fck Estimado (MPa)</th>
                    <th className="border border-slate-200 px-3 py-2 text-right">fck Projeto (MPa)</th>
                    <th className="border border-slate-200 px-3 py-2 text-center">Conformidade</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => {
                    const isFinal = r.age_days === finalAge;
                    const rowColor = r.compliant === true ? 'bg-green-50' : r.compliant === false ? 'bg-red-50' : '';
                    return (
                      <tr key={r.age_days} className={rowColor}>
                        <td className="border border-slate-200 px-3 py-2 font-medium">
                          {r.age_days} {isFinal && <span className="text-[10px] text-slate-500">(ref.)</span>}
                        </td>
                        <td className="border border-slate-200 px-3 py-2">{fmtDate(r.rupture_date)}</td>
                        <td className="border border-slate-200 px-3 py-2 text-center">{r.cp_count}</td>
                        <td className="border border-slate-200 px-3 py-2 text-right font-semibold">{r.average ? r.average.toFixed(2) : '—'}</td>
                        <td className="border border-slate-200 px-3 py-2 text-right">{r.estimated_fck ? r.estimated_fck.toFixed(2) : '—'}</td>
                        <td className="border border-slate-200 px-3 py-2 text-right">{r.target || '—'}</td>
                        <td className="border border-slate-200 px-3 py-2 text-center">
                          {r.compliant === true ? (
                            <span className="text-xs font-semibold text-green-700 bg-green-100 border border-green-200 rounded-full px-2 py-0.5">Conforme</span>
                          ) : r.compliant === false ? (
                            <span className="text-xs font-semibold text-red-700 bg-red-100 border border-red-200 rounded-full px-2 py-0.5">Não Conforme</span>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            <p className="text-[11px] text-slate-500 mt-2">
              A conformidade de cada idade é calculada quando há 3+ corpos de prova válidos. Linhas em verde = conforme; vermelho = não conforme.
            </p>
          </section>

          {/* Resultados detalhados por idade */}
          <section>
            <h2 className="text-sm font-bold uppercase text-slate-700 border-b border-slate-200 pb-1 mb-3">
              Resultados por Idade de Ensaio
            </h2>
            {groups.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum corpo de prova registrado.</p>
            ) : (
              <div className="space-y-4">
                {groups.map(g => {
                  const stats = ageStats(g.specimens);
                  const isFinal = g.age_days === finalAge;
                  const rDate = ruptureDate(report.molding_date, g.age_days);
                  return (
                    <div key={g.age_days} className={`rounded-lg border ${isFinal ? 'border-slate-900 bg-slate-50' : 'border-slate-200'}`}>
                      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-slate-100/60">
                        <p className="text-xs font-bold uppercase text-slate-700">
                          {g.age_days} dias {isFinal && <span className="text-slate-900 normal-case">— idade de referência</span>}
                        </p>
                        <div className="flex gap-4 text-xs text-slate-600">
                          <span>Rompimento: <strong>{fmtDate(rDate)}</strong></span>
                          <span>Média: <strong>{stats.average ? stats.average.toFixed(2) : '—'} MPa</strong></span>
                          <span>Mín.: <strong>{stats.min ? stats.min.toFixed(2) : '—'} MPa</strong></span>
                        </div>
                      </div>
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="text-xs uppercase text-slate-500">
                            <th className="border border-slate-200 px-2 py-1 text-left">CP</th>
                            <th className="border border-slate-200 px-2 py-1 text-right">Larg. (mm)</th>
                            <th className="border border-slate-200 px-2 py-1 text-right">Comp. (mm)</th>
                            <th className="border border-slate-200 px-2 py-1 text-right">Alt. (mm)</th>
                            <th className="border border-slate-200 px-2 py-1 text-right">Área (cm²)</th>
                            <th className="border border-slate-200 px-2 py-1 text-right">Massa (g)</th>
                            <th className="border border-slate-200 px-2 py-1 text-right">Carga (kN)</th>
                            <th className="border border-slate-200 px-2 py-1 text-right">Resist. (MPa)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.specimens.map(s => (
                            <tr key={s.id}>
                              <td className="border border-slate-200 px-2 py-1 font-medium">{s.id}</td>
                              <td className="border border-slate-200 px-2 py-1 text-right">{s.width_mm || '—'}</td>
                              <td className="border border-slate-200 px-2 py-1 text-right">{s.length_mm || '—'}</td>
                              <td className="border border-slate-200 px-2 py-1 text-right">{s.height_mm || '—'}</td>
                              <td className="border border-slate-200 px-2 py-1 text-right">{s.area_cm2}</td>
                              <td className="border border-slate-200 px-2 py-1 text-right">{s.mass_g || '—'}</td>
                              <td className="border border-slate-200 px-2 py-1 text-right">{s.rupture_load_kn}</td>
                              <td className="border border-slate-200 px-2 py-1 text-right font-semibold">{s.resistance_mpa}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Resumo final */}
          <section className="grid grid-cols-5 gap-3 text-sm">
            <Box label={`Resistência Média (${finalAge}d)`} value={`${(report.average_resistance || 0).toFixed(2)} MPa`} />
            <Box label="Menor Individual" value={`${(report.min_resistance || 0).toFixed(2)} MPa`} />
            <Box label="fck Estimado" value={report.estimated_fck ? `${report.estimated_fck.toFixed(2)} MPa` : '—'} />
            <Box label="fck Projeto" value={report.target_resistance ? `${report.target_resistance} MPa` : '—'} />
            <Box label="Conformidade" value={compliant ? 'CONFORME' : 'NÃO CONFORME'} highlight={compliant ? 'green' : 'red'} />
          </section>

          {/* Alertas */}
          {alerts.length > 0 && (
            <section className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-amber-700 text-sm font-semibold mb-2">
                <AlertTriangle className="w-4 h-4" /> Alertas de Não Conformidade (informativos)
              </div>
              <ul className="space-y-1">
                {alerts.map((a, i) => (
                  <li key={i} className="text-sm text-amber-700 flex items-start gap-2">
                    <span className="mt-0.5">•</span>{a}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Conclusão */}
          <section>
            <h2 className="text-sm font-bold uppercase text-slate-700 border-b border-slate-200 pb-1 mb-2">Conclusão</h2>
            <p className="text-sm leading-relaxed">{report.conclusion || '—'}</p>
            {report.notes && (
              <div className="mt-3">
                <p className="text-xs font-semibold text-slate-600 mb-1">Observações:</p>
                <p className="text-sm text-slate-600">{report.notes}</p>
              </div>
            )}
          </section>

          {/* Assinatura */}
          <section className="mt-12">
            <div className="border-t border-slate-400 pt-1 max-w-xs text-center">
              <p className="text-sm">{report.responsible_engineer || 'Engenheiro Responsável'}</p>
              <p className="text-xs text-slate-600">Engenheiro Civil {report.engineer_crea ? `— CREA ${report.engineer_crea}` : ''}</p>
            </div>
          </section>
        </div>

        {/* ===== Print view — apenas a idade selecionada ===== */}
        <div className="hidden print:block">
          <PrintLaudoBlock report={report} group={groups.find(g => g.age_days === printAge) || groups[0] || null} />
        </div>
      </div>
    </div>
  );
}

function PrintLaudoBlock({ report, group }) {
  const pavimento = report.norm_reference === 'NBR 9781';
  const specimens = group ? group.specimens : [];
  const ageDays = group ? group.age_days : 0;
  const row = group ? ageRowData(report, group) : null;
  const rDate = group ? ruptureDate(report.molding_date, ageDays) : null;
  const stats = group ? ageStats(specimens) : { average: 0, min: 0 };
  const target = Number(report.target_resistance) || 0;
  const isFinalAge = ageDays >= (report.final_age_days || 28);
  const alerts = group ? buildAlerts({
    norm_reference: report.norm_reference,
    average: stats.average,
    min: stats.min,
    target,
    traffic_type: report.traffic_type,
    thickness_ok: report.thickness_ok,
    hasFinalAge: isFinalAge,
  }) : [];
  const thicknessVariation = (report.nominal_thickness_mm != null && report.measured_thickness_mm != null)
    ? Math.abs(Number(report.measured_thickness_mm) - Number(report.nominal_thickness_mm))
    : null;

  return (
    <div>
      <div className="p-8 space-y-6">
        {/* Cabeçalho */}
        <div className="border-b-2 border-slate-900 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                LAUDO TÉCNICO DE ENSAIO DE COMPRESSÃO AXIAL
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Norma de referência: <strong>{report.norm_reference}</strong>
                {pavimento ? ' — Pavimentos Intertravados de Concreto' : ' — Blocos Vazados de Concreto'}
              </p>
              <p className="text-xs text-slate-500 mt-1">Idade de Ruptura: <strong>{ageDays} dias</strong></p>
            </div>
            <div className="text-right text-sm">
              <p>Nº: <strong>{report.report_number}</strong></p>
              <p className="text-slate-600">Rompimento: <strong>{fmtDate(rDate)}</strong></p>
            </div>
          </div>
        </div>

        {/* Laboratório */}
        <section className="grid grid-cols-2 gap-4 text-sm">
          <Info label="Laboratório" value={report.laboratory_name} />
          <Info label="Responsável Técnico" value={`${report.responsible_engineer || '—'}${report.engineer_crea ? ` — CREA ${report.engineer_crea}` : ''}`} />
        </section>

        {/* Equipamento de Ensaio */}
        <section>
          <h2 className="text-sm font-bold uppercase text-slate-700 border-b border-slate-200 pb-1 mb-3">Equipamento de Ensaio e Calibração</h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <Info label="Máquina de Ensaio" value={report.test_equipment} />
            <Info label="Calibração Nº" value={report.calibration_number} />
            <Info label="Data da Calibração" value={fmtDate(report.calibration_date)} />
            <Info label="Emitente" value={report.calibration_issuer} />
          </div>
        </section>

        {/* Rastreabilidade */}
        <section>
          <h2 className="text-sm font-bold uppercase text-slate-700 border-b border-slate-200 pb-1 mb-3">Rastreabilidade do Lote</h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <Info label="Ordem de Produção" value={report.order_number} />
            <Info label="Artefato" value={report.product_type_name} />
            <Info label="Categoria" value={report.category} />
            <Info label="Norma" value={report.norm_reference} />
            <Info label="Fabricante" value={report.manufacturer} />
            <Info label="Local de Aplicação" value={report.application_location} />
            <Info label="Data de Moldagem" value={fmtDate(report.molding_date)} />
            <Info label="Idade de Ruptura" value={`${ageDays} dias`} />
            <Info label="Data de Rompimento" value={fmtDate(rDate)} />
            <Info label="fck de Projeto" value={target ? `${target} MPa` : '—'} />
          </div>
        </section>

        {/* Requisitos NBR 9781 */}
        {pavimento && (
          <section>
            <h2 className="text-sm font-bold uppercase text-slate-700 border-b border-slate-200 pb-1 mb-3">Verificação Dimensional — NBR 9781</h2>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <Info label="Tipo de Tráfego" value={report.traffic_type} />
              <Info label="Resist. Mínima (norma)" value={`${MIN_RESISTANCE_BY_TRAFFIC[report.traffic_type] || '—'} MPa`} />
              <Info label="Espessura Mínima (norma)" value={`${(MIN_THICKNESS_BY_TRAFFIC[report.traffic_type] || 0) / 10} cm`} />
              <Info label="Espessura Nominal" value={report.nominal_thickness_mm ? `${report.nominal_thickness_mm} mm` : '—'} />
              <Info label="Espessura Medida" value={report.measured_thickness_mm ? `${report.measured_thickness_mm} mm` : '—'} />
              <div>
                <p className="text-xs text-slate-500">Variação (tol. ±{DIMENSIONAL_TOLERANCE_MM} mm)</p>
                <p className="font-medium flex items-center gap-1.5">
                  {thicknessVariation != null ? `${thicknessVariation.toFixed(1)} mm` : '—'}
                  {report.thickness_ok === false && (
                    <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                      <AlertTriangle className="w-3 h-3" /> Fora
                    </span>
                  )}
                  {report.thickness_ok === true && thicknessVariation != null && (
                    <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                      <CheckCircle2 className="w-3 h-3" /> OK
                    </span>
                  )}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* CP table for this age */}
        <section>
          <h2 className="text-sm font-bold uppercase text-slate-700 border-b border-slate-200 pb-1 mb-3">
            Resultados dos Corpos de Prova — {ageDays} dias
          </h2>
          {specimens.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum corpo de prova registrado para esta idade.</p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-xs uppercase text-slate-500">
                  <th className="border border-slate-200 px-2 py-1 text-left">CP</th>
                  <th className="border border-slate-200 px-2 py-1 text-right">Larg. (mm)</th>
                  <th className="border border-slate-200 px-2 py-1 text-right">Comp. (mm)</th>
                  <th className="border border-slate-200 px-2 py-1 text-right">Alt. (mm)</th>
                  <th className="border border-slate-200 px-2 py-1 text-right">Área (cm²)</th>
                  <th className="border border-slate-200 px-2 py-1 text-right">Massa (g)</th>
                  <th className="border border-slate-200 px-2 py-1 text-right">Carga (kN)</th>
                  <th className="border border-slate-200 px-2 py-1 text-right">Resist. (MPa)</th>
                </tr>
              </thead>
              <tbody>
                {specimens.map(s => (
                  <tr key={s.id}>
                    <td className="border border-slate-200 px-2 py-1 font-medium">{s.id}</td>
                    <td className="border border-slate-200 px-2 py-1 text-right">{s.width_mm || '—'}</td>
                    <td className="border border-slate-200 px-2 py-1 text-right">{s.length_mm || '—'}</td>
                    <td className="border border-slate-200 px-2 py-1 text-right">{s.height_mm || '—'}</td>
                    <td className="border border-slate-200 px-2 py-1 text-right">{s.area_cm2}</td>
                    <td className="border border-slate-200 px-2 py-1 text-right">{s.mass_g || '—'}</td>
                    <td className="border border-slate-200 px-2 py-1 text-right">{s.rupture_load_kn}</td>
                    <td className="border border-slate-200 px-2 py-1 text-right font-semibold">{s.resistance_mpa}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Resumo específico da idade */}
        <section className="grid grid-cols-5 gap-3 text-sm">
          <Box label={`Resistência Média (${ageDays}d)`} value={`${(stats.average || 0).toFixed(2)} MPa`} />
          <Box label="Menor Individual" value={`${(stats.min || 0).toFixed(2)} MPa`} />
          <Box label="fck Estimado" value={row && row.estimated_fck ? `${row.estimated_fck.toFixed(2)} MPa` : '—'} />
          <Box label="fck Projeto" value={target ? `${target} MPa` : '—'} />
          <Box
            label="Conformidade"
            value={row && row.compliant != null ? (row.compliant ? 'CONFORME' : 'NÃO CONFORME') : '—'}
            highlight={row && row.compliant != null ? (row.compliant ? 'green' : 'red') : null}
          />
        </section>

        {/* Alertas */}
        {alerts.length > 0 && (
          <section className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-amber-700 text-sm font-semibold mb-2">
              <AlertTriangle className="w-4 h-4" /> Alertas de Não Conformidade (informativos)
            </div>
            <ul className="space-y-1">
              {alerts.map((a, i) => (
                <li key={i} className="text-sm text-amber-700 flex items-start gap-2">
                  <span className="mt-0.5">•</span>{a}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Conclusão */}
        <section>
          <h2 className="text-sm font-bold uppercase text-slate-700 border-b border-slate-200 pb-1 mb-2">Conclusão</h2>
          <p className="text-sm leading-relaxed">{report.conclusion || '—'}</p>
          {report.notes && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-slate-600 mb-1">Observações:</p>
              <p className="text-sm text-slate-600">{report.notes}</p>
            </div>
          )}
        </section>

        {/* Assinatura */}
        <section className="mt-12">
          <div className="border-t border-slate-400 pt-1 max-w-xs text-center">
            <p className="text-sm">{report.responsible_engineer || 'Engenheiro Responsável'}</p>
            <p className="text-xs text-slate-600">Engenheiro Civil {report.engineer_crea ? `— CREA ${report.engineer_crea}` : ''}</p>
          </div>
        </section>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-medium">{value || '—'}</p>
    </div>
  );
}

function Box({ label, value, highlight }) {
  const color = highlight === 'green' ? 'text-green-700 bg-green-50 border-green-200'
    : highlight === 'red' ? 'text-red-700 bg-red-50 border-red-200'
    : 'text-slate-900 bg-slate-50 border-slate-200';
  return (
    <div className={`rounded-lg border p-3 text-center ${color}`}>
      <p className="text-xs uppercase text-slate-500 font-semibold">{label}</p>
      <p className="text-base font-bold mt-0.5">{value}</p>
    </div>
  );
}