// Status da base e confiança da projeção — critérios OBJETIVOS e documentados.
// Nunca arbitrária: pontuação determinística a partir da base, dispersão,
// distância de extrapolação e histórico de validação.

export function baseStatus({ result_count, lot_count, age_count, validated_count }) {
  if (result_count < 5 || age_count < 2) {
    return { key: 'insuficiente', label: 'BASE INSUFICIENTE' };
  }
  if (result_count < 15 || lot_count < 4) {
    return { key: 'formacao', label: 'BASE EM FORMAÇÃO' };
  }
  if (result_count < 50 || lot_count < 10 || (validated_count || 0) < 3) {
    return { key: 'consistente', label: 'BASE CONSISTENTE' };
  }
  return { key: 'robusta', label: 'BASE ROBUSTA' };
}

// Pontuação 0–100 com fatores rastreáveis. Faixas: ≥65 ALTA · ≥40 MÉDIA · <40 BAIXA.
export function confidence({ result_count, lot_count, age_count, avg_cv, max_real_age, max_projected_age, validated_count, backtest }) {
  let score = 0;
  const factors = [];
  // 1. quantidade de lotes (0–25)
  if (lot_count >= 15) { score += 25; factors.push('muitos lotes'); }
  else if (lot_count >= 8) { score += 18; factors.push('bom número de lotes'); }
  else if (lot_count >= 4) { score += 10; factors.push('poucos lotes'); }
  else { score += Math.min(lot_count * 2, 6); factors.push('base pequena de lotes'); }
  // 2. quantidade de resultados (0–20)
  if (result_count >= 50) { score += 20; factors.push('muitos resultados'); }
  else if (result_count >= 20) { score += 14; factors.push('resultados suficientes'); }
  else if (result_count >= 10) { score += 8; factors.push('poucos resultados'); }
  else { score += Math.min(result_count, 6); factors.push('base pequena de resultados'); }
  // 3. quantidade de idades (0–15)
  if (age_count >= 4) { score += 15; factors.push('várias idades ensaiadas'); }
  else if (age_count >= 3) { score += 10; }
  else if (age_count >= 2) { score += 5; factors.push('idades limitadas'); }
  else { factors.push('uma única idade'); }
  // 4. dispersão (penalidade)
  if (avg_cv > 25) { score -= 15; factors.push('alta dispersão histórica'); }
  else if (avg_cv > 15) { score -= 7; factors.push('dispersão moderada'); }
  // 5. distância da extrapolação (penalidade)
  const dist = max_projected_age && max_real_age ? max_projected_age / max_real_age : null;
  if (dist != null && dist > 4) { score -= 30; factors.push('extrapolação muito longe do histórico'); }
  else if (dist != null && dist > 2) { score -= 15; factors.push('extrapolação além do histórico'); }
  else if (dist != null && dist > 1.5) { score -= 7; factors.push('extrapolação moderada'); }
  // 6. histórico de validação (bônus)
  if ((validated_count || 0) >= 5) { score += 15; factors.push('previsões já validadas'); }
  else if ((validated_count || 0) >= 1) { score += 5; }
  if (backtest && backtest.n >= 5 && backtest.mape != null && backtest.mape <= 10) {
    score += 10;
    factors.push('backtesting com erro baixo');
  }
  score = Math.max(0, Math.min(100, score));
  const level = score >= 65 ? 'ALTA' : score >= 40 ? 'MÉDIA' : 'BAIXA';
  return { level, score, factors };
}