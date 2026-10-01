import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Layers, Gauge, Droplets, ShieldCheck, FileCheck2 } from 'lucide-react';
import {
  BLOCK_COMPRESSION_REVISIONS,
  resolveLoadingRate,
  validateLoadingRate,
} from '@/lib/qualityNorms';

// Seção específica para blocos NBR 6136-1/-2:2026 no formulário de laudo.
// Inclui alternador de revisão, fbk do produto, velocidade de carregamento,
// condição de preparação/umidade, equipamento e processo de aceitação.
export default function BlockCompressionSection({
  form,
  setField,
  productType,
  blockResult,
  proofSpecs,
  counterproofSpecs,
  counterproofState,
  onCounterproofStateChange,
  onToggleProofSpec,
  onToggleCounterproofSpec,
  onAddCounterproofSpec,
  onRemoveCounterproofSpec,
  onUpdateCounterproofSpec,
}) {
  const is2026 = form.normative_revision === '2026';
  const fbkEspecificado = useMemo(() => {
    return Number(productType?.fbk_especificado_mpa) || Number(form.target_resistance) || 0;
  }, [productType, form.target_resistance]);

  const loadingRate = useMemo(() => {
    if (!is2026 || !fbkEspecificado) return null;
    return resolveLoadingRate(fbkEspecificado);
  }, [is2026, fbkEspecificado]);

  const loadingValidation = useMemo(() => {
    if (!is2026 || !form.loading_rate_mpa_s || !fbkEspecificado) return null;
    return validateLoadingRate(form.loading_rate_mpa_s, fbkEspecificado);
  }, [is2026, form.loading_rate_mpa_s, fbkEspecificado]);

  const counterproofStates = ['NOT_REQUIRED', 'AVAILABLE', 'REQUIRED', 'IN_PROGRESS', 'COMPLETED'];
  const stateLabels = {
    NOT_REQUIRED: 'Não necessária',
    AVAILABLE: 'Disponível',
    REQUIRED: 'Necessária',
    IN_PROGRESS: 'Em andamento',
    COMPLETED: 'Concluída',
  };

  return (
    <section className="border border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/20 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Layers className="w-4 h-4 text-blue-600" />
        <h3 className="text-sm font-semibold text-foreground">Requisitos NBR 6136 — Blocos Vazados de Concreto</h3>
      </div>

      {/* Alternador de revisão */}
      <div className="border-t border-blue-200 dark:border-blue-900 pt-2">
        <label className="block text-xs font-medium text-muted-foreground mb-1">Revisão da Norma de Compressão</label>
        <div className="flex items-center gap-3 flex-wrap">
          {BLOCK_COMPRESSION_REVISIONS.map(r => (
            <button key={r.value} type="button"
              onClick={() => setField('normative_revision', r.value)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium border transition-colors ${
                form.normative_revision === r.value
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-blue-300 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30'
              }`}>
              {r.label}
            </button>
          ))}
        </div>
        {is2026 && (
          <p className="text-xs text-muted-foreground mt-1">
            Motor blockCompressionEngine v2026.1 — NBR 6136-1:2026 (requisitos) + NBR 6136-2:2026 (métodos).
            fb = F/Ab (área bruta). fbk,est = 2 × média(i−1 menores) − fb(i). Piso: Ψ × fb(1).
          </p>
        )}
      </div>

      {/* fbk do produto (buscado automaticamente) */}
      {is2026 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border-t border-blue-200 dark:border-blue-900 pt-2">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">fbk Especificado (do produto)</label>
            <input type="number" step="0.1" readOnly
              className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-muted/40 text-muted-foreground font-medium"
              value={fbkEspecificado || ''} />
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {productType?.fbk_especificado_mpa
                ? 'Origem: cadastro do produto (fbk_especificado_mpa).'
                : 'Origem: resistência de projeto (target_resistance). Cadastre fbk_especificado_mpa no produto.'}
            </p>
          </div>

          {/* Velocidade de carregamento */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Velocidade de Carregamento (MPa/s)
            </label>
            <input type="number" step="0.01"
              className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background"
              value={form.loading_rate_mpa_s || ''}
              onChange={e => setField('loading_rate_mpa_s', parseFloat(e.target.value))}
              placeholder="Ex: 0.15" />
            {loadingRate && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Norma: {loadingRate.min}–{loadingRate.max} MPa/s
                {fbkEspecificado >= 8 ? ' (fbk ≥ 8 MPa)' : ' (fbk < 8 MPa)'}
              </p>
            )}
            {loadingValidation && (
              <p className={`text-[10px] mt-0.5 font-medium ${loadingValidation.status === 'DENTRO_DO_LIMITE' ? 'text-green-600' : 'text-red-600'}`}>
                {loadingValidation.message}
              </p>
            )}
          </div>

          {/* Condição de preparação */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Condição de Preparação</label>
            <select className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background"
              value={form.preparation_condition || ''}
              onChange={e => setField('preparation_condition', e.target.value)}>
              <option value="">—</option>
              <option value="seco_ar">Seco ao ar</option>
              <option value="imersao">Imersão</option>
              <option value="estufa">Estufa</option>
            </select>
            {form.preparation_condition === 'estufa' && (
              <div className="grid grid-cols-3 gap-1 mt-1">
                <input type="number" step="0.1" placeholder="Temp °C" className="px-2 py-1 border border-input rounded text-[11px] bg-background"
                  value={form.temperature_c || ''} onChange={e => setField('temperature_c', parseFloat(e.target.value))} />
                <input type="number" step="0.1" placeholder="Horas" className="px-2 py-1 border border-input rounded text-[11px] bg-background"
                  value={form.exposure_time_hours || ''} onChange={e => setField('exposure_time_hours', parseFloat(e.target.value))} />
                <input type="number" step="0.1" placeholder="Min pós" className="px-2 py-1 border border-input rounded text-[11px] bg-background"
                  value={form.post_oven_test_time_minutes || ''} onChange={e => setField('post_oven_test_time_minutes', parseFloat(e.target.value))} />
              </div>
            )}
          </div>

          {/* Umidade relativa */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Umidade Relativa (%)</label>
            <input type="number" step="0.1"
              className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background"
              value={form.humidity_relative_percent || ''}
              onChange={e => setField('humidity_relative_percent', parseFloat(e.target.value))} />
          </div>
        </div>
      )}

      {/* Resultados do motor 2026 */}
      {is2026 && blockResult && !blockResult.error && (
        <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
            blockCompressionEngine v2026.1 — Resultados
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div className="bg-white dark:bg-slate-800 rounded p-2 border border-slate-200 dark:border-slate-700">
              <p className="text-muted-foreground">fbk Calculado (MPa)</p>
              <p className="font-bold text-foreground text-sm">{blockResult.fbk_calculado?.toFixed(2)}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded p-2 border border-slate-200 dark:border-slate-700">
              <p className="text-muted-foreground">Ψ × fb(1) (MPa)</p>
              <p className="font-bold text-foreground text-sm">{blockResult.fbk_minimo_psi?.toFixed(2)}</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded p-2 border border-blue-200 dark:border-blue-800">
              <p className="text-muted-foreground">fbk Estimado (MPa)</p>
              <p className="font-bold text-blue-600 text-sm">{blockResult.fbk_estimado?.toFixed(2)}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded p-2 border border-slate-200 dark:border-slate-700">
              <p className="text-muted-foreground">Coeficiente Ψ</p>
              <p className="font-bold text-foreground text-sm">{blockResult.psi ?? '—'}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="bg-white dark:bg-slate-800 rounded p-2 border border-slate-200 dark:border-slate-700">
              <p className="text-muted-foreground">n (CPs)</p>
              <p className="font-bold text-foreground text-sm">{blockResult.n}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded p-2 border border-slate-200 dark:border-slate-700">
              <p className="text-muted-foreground">Índice i</p>
              <p className="font-bold text-foreground text-sm">{blockResult.i ?? '—'}</p>
            </div>
            <div className={`rounded p-2 border text-center ${blockResult.compliant ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900' : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900'}`}>
              <p className="text-muted-foreground">Conformidade</p>
              <p className={`font-bold text-sm ${blockResult.compliant ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                {blockResult.compliant ? 'CONFORME' : 'NÃO CONFORME'}
              </p>
            </div>
          </div>

          {/* Memória de cálculo */}
          {blockResult.calculation_memory?.steps?.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-medium">
                Ver memória de cálculo ({blockResult.calculation_memory.steps.length} passos)
              </summary>
              <ol className="mt-2 space-y-1 pl-4 list-decimal">
                {blockResult.calculation_memory.steps.map((s, i) => (
                  <li key={i} className="text-muted-foreground">
                    {s.description}
                    {s.value != null && <span className="font-medium text-foreground"> → {typeof s.value === 'number' ? s.value.toFixed(2) : s.value}</span>}
                    {s.formula && <span className="text-slate-500"> ({s.formula})</span>}
                    {s.values && <span className="text-slate-500"> [{s.values.map(v => typeof v === 'number' ? v.toFixed(2) : v).join(', ')}]</span>}
                  </li>
                ))}
              </ol>
            </details>
          )}
        </div>
      )}

      {/* Erro do motor */}
      {is2026 && blockResult?.error && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg p-3 text-xs text-red-700 dark:text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {blockResult.error_message}
        </div>
      )}

      {/* Processo de aceitação (prova/contraprova) */}
      {is2026 && (
        <div className="border-t border-blue-200 dark:border-blue-900 pt-2 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            Processo de Aceitação — Prova / Contraprova
          </div>
          <p className="text-[10px] text-muted-foreground">
            A prova utiliza 6 CPs da idade de referência (28 dias). A contraprova é independente — nunca somada à prova.
          </p>

          {/* Estado da contraprova */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Contraprova:</span>
            {counterproofStates.map(st => (
              <button key={st} type="button"
                onClick={() => onCounterproofStateChange(st)}
                className={`px-2 py-1 text-[10px] rounded font-medium border transition-colors ${
                  counterproofState === st
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-blue-300 text-blue-700 dark:text-blue-400 hover:bg-blue-50'
                }`}>
                {stateLabels[st]}
              </button>
            ))}
          </div>

          {/* CPs da prova */}
          <div className="text-xs">
            <p className="font-medium text-muted-foreground mb-1">CPs da Prova (marcar na idade de referência):</p>
            <div className="flex flex-wrap gap-1">
              {proofSpecs.map((s, i) => (
                <button key={s.id || i} type="button"
                  onClick={() => onToggleProofSpec(s)}
                  className={`px-2 py-1 text-[10px] rounded border transition-colors ${
                    s.sample_role === 'proof'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-slate-300 text-slate-600 hover:bg-slate-100'
                  }`}>
                  CP {s.id || i + 1} {s.sample_role === 'proof' ? '✓' : ''}
                </button>
              ))}
            </div>
          </div>

          {/* CPs da contraprova */}
          {counterproofState !== 'NOT_REQUIRED' && (
            <div className="text-xs space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-medium text-muted-foreground">CPs da Contraprova (6 CPs independentes):</p>
                <button type="button" onClick={onAddCounterproofSpec}
                  className="text-[10px] text-blue-600 hover:underline">+ CP contraprova</button>
              </div>
              {counterproofSpecs.length === 0 ? (
                <p className="text-muted-foreground text-[10px]">Nenhum CP de contraprova registrado.</p>
              ) : (
                <div className="space-y-1">
                  {counterproofSpecs.map((s, i) => (
                    <div key={s.id || i} className="grid grid-cols-4 gap-1 items-center">
                      <input type="number" step="0.1" placeholder="Larg (mm)" className="px-1 py-1 border border-input rounded text-[11px] bg-background"
                        value={s.width_mm || ''} onChange={e => onUpdateCounterproofSpec(i, 'width_mm', parseFloat(e.target.value))} />
                      <input type="number" step="0.1" placeholder="Comp (mm)" className="px-1 py-1 border border-input rounded text-[11px] bg-background"
                        value={s.length_mm || ''} onChange={e => onUpdateCounterproofSpec(i, 'length_mm', parseFloat(e.target.value))} />
                      <input type="number" step="0.1" placeholder="Carga (kN)" className="px-1 py-1 border border-input rounded text-[11px] bg-background"
                        value={s.rupture_load_kn || ''} onChange={e => onUpdateCounterproofSpec(i, 'rupture_load_kn', parseFloat(e.target.value))} />
                      <button type="button" onClick={() => onRemoveCounterproofSpec(i)}
                        className="text-red-500 hover:text-red-700 text-[10px]">Remover</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}