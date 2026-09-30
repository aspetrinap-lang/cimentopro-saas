// Alertas analíticos da curva — informativos, NUNCA normativos
// (não aprovam nem reprovam produtos; os critérios NBR ficam nos laudos).

export function curveAlerts({ base, realPoints, referencePoints, ai, validatedPredictions }) {
  const alerts = [];
  if (base.status_key === 'insuficiente') {
    alerts.push({
      code: 'DADOS_INSUFICIENTES',
      message: 'Base histórica insuficiente — dados insuficientes para projeção confiável.',
    });
  }
  // REAL × REFERÊNCIA (quando a referência tem valor absoluto, i.e. R28 conhecido)
  (realPoints || []).forEach((rp) => {
    const ref = (referencePoints || []).find((p) => p.age_days === rp.age_days);
    if (!ref || ref.lower == null) return;
    if (rp.average < ref.lower) {
      alerts.push({
        code: 'EVOLUCAO_ABAIXO_REFERENCIA',
        message: `Média aos ${rp.age_days} dias (${rp.average} MPa) abaixo da faixa de referência histórica (${ref.lower}–${ref.upper} MPa).`,
      });
    } else if (rp.average > ref.upper) {
      alerts.push({
        code: 'EVOLUCAO_ACIMA_REFERENCIA',
        message: `Média aos ${rp.age_days} dias (${rp.average} MPa) acima da faixa de referência histórica (${ref.lower}–${ref.upper} MPa).`,
      });
    }
  });
  // REAL × IA — resultados posteriores comparados à projeção
  (validatedPredictions || []).forEach((v) => {
    if (v.prediction_error == null) return;
    if (v.prediction_error < 0) {
      alerts.push({
        code: 'ABAIXO_PROJECAO_IA',
        message: `Resultado real aos ${v.target_age_days} dias (${v.actual_strength} MPa) inferior à projeção IA (${v.predicted_strength} MPa).`,
      });
    } else if (v.prediction_error > 0) {
      alerts.push({
        code: 'ACIMA_PROJECAO_IA',
        message: `Resultado real aos ${v.target_age_days} dias (${v.actual_strength} MPa) superior à projeção IA (${v.predicted_strength} MPa).`,
      });
    }
  });
  // CURVA DIVERGENTE — última validação com |erro percentual| > 15%
  const validated = (validatedPredictions || []).filter((v) => v.prediction_error_pct != null);
  if (validated.length >= 2) {
    const last = validated[validated.length - 1];
    if (Math.abs(last.prediction_error_pct) > 15) {
      alerts.push({
        code: 'CURVA_DIVERGENTE',
        message: `Última validação divergiu ${last.prediction_error_pct > 0 ? '+' : ''}${last.prediction_error_pct}% da projeção — acompanhar os próximos ensaios.`,
      });
    }
  }
  // CURVA INSTÁVEL — dispersão alta em idades com 3+ ensaios
  const unstable = (realPoints || []).filter((p) => p.count >= 3 && p.cv != null && p.cv > 20);
  if (unstable.length > 0) {
    alerts.push({
      code: 'CURVA_INSTAVEL',
      message: `Alta dispersão histórica (CV > 20%) aos ${unstable.map((u) => u.age_days).join(', ')} dias.`,
    });
  }
  // EXTRAPOLAÇÃO LONGA — projeção muito além do histórico ensaiado
  if (ai && ai.available && realPoints && realPoints.length > 0) {
    const maxReal = Math.max(...realPoints.map((p) => p.age_days));
    const maxProj = Math.max(...ai.points.map((p) => p.age_days));
    if (maxProj > maxReal * 2) {
      alerts.push({
        code: 'EXTRAPOLACAO_LONGA',
        message: `Projeção vai até ${maxProj} dias, além do histórico ensaiado (${maxReal} dias) — tratar como estimativa ampla.`,
      });
    }
  }
  // Outliers sinalizados (nunca excluídos)
  const outlierAges = [...new Set((realPoints || []).filter((p) => p.outlier_count > 0).map((p) => p.age_days))];
  if (outlierAges.length > 0) {
    alerts.push({
      code: 'OUTLIERS_SINALIZADOS',
      message: `Possíveis resultados atípicos sinalizados aos ${outlierAges.join(', ')} dias (preservados na curva).`,
    });
  }
  return alerts;
}