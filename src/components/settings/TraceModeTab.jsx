import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { X, ArrowLeftRight } from 'lucide-react';
import { useConfig } from '@/lib/ConfigContext';
import { useAuth } from '@/lib/AuthContext';
import { deriveDirectWeights, buildModeSwitchPayload, formatRatioLabel } from '@/lib/traceDirect';

function fmt(val) {
  return Number(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ModeBadge({ mode }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${mode === 'direct' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
      {mode === 'direct' ? 'Peso Direto' : 'Proporção'}
    </span>
  );
}

// Aba de configuração (somente admin): alternância do modo de entrada do traço
// (proporção ↔ peso direto), com reconversão dos valores e histórico registrado.
export default function TraceModeTab({ traces, onChanged }) {
  const { user } = useAuth();
  const { rawMaterials } = useConfig();
  const [target, setTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  function matName(key) {
    return rawMaterials.find(m => m.key === key)?.name || key;
  }

  const toMode = target ? (target.input_mode === 'direct' ? 'ratio' : 'direct') : null;
  const preview = target ? deriveDirectWeights(target) : null;
  const aggKg = target
    ? Object.keys(target.materials_composition || {})
        .filter(k => target.materials_composition[k]?.type !== 'additive')
        .reduce((s, k) => s + (preview.weights[k] || 0), 0)
    : 0;
  const aggParts = preview && preview.cementKg > 0 ? aggKg / preview.cementKg : 0;

  async function confirmSwitch() {
    setSaving(true);
    const payload = buildModeSwitchPayload(target, toMode, user?.email);
    await base44.entities.ConcreteTrace.update(target.id, payload);
    setSaving(false);
    setTarget(null);
    onChanged();
  }

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-border shadow-sm p-4">
        <p className="text-sm font-medium text-foreground">Modo de entrada dos traços</p>
        <p className="text-xs text-muted-foreground mt-1">
          O modo é escolhido na criação do traço. Use esta aba apenas para corrigir traços existentes:
          a alternância recalcula os valores (kg ↔ proporção) e fica registrada no histórico do traço.
        </p>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {traces.length === 0 ? (
          <div className="px-5 py-12 text-center text-muted-foreground text-sm">Nenhum traço cadastrado.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wide">
                <th className="px-5 py-3 text-left font-semibold">Traço</th>
                <th className="px-5 py-3 text-left font-semibold">Modo Atual</th>
                <th className="px-5 py-3 text-right font-semibold">Ação</th>
              </tr>
            </thead>
            <tbody>
              {traces.map(t => (
                <tr key={t.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3">
                    <p className="font-medium text-foreground">{t.name}</p>
                    {t.resistance_mpa ? <p className="text-xs text-muted-foreground">{t.resistance_mpa} MPa</p> : null}
                  </td>
                  <td className="px-5 py-3"><ModeBadge mode={t.input_mode || 'ratio'} /></td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end">
                      <button onClick={() => setTarget(t)}
                        className="flex items-center gap-1.5 border border-border rounded-lg px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors">
                        <ArrowLeftRight className="w-3.5 h-3.5" />
                        Alternar para {t.input_mode === 'direct' ? 'Proporção' : 'Peso Direto'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {target && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border border-border">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="font-semibold text-foreground">Alternar Modo do Traço</h3>
              <button onClick={() => setTarget(null)} className="text-muted-foreground hover:text-foreground transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-foreground font-medium">{target.name}</p>
              <div className="flex items-center gap-3">
                <ModeBadge mode={target.input_mode || 'ratio'} />
                <ArrowLeftRight className="w-4 h-4 text-muted-foreground" />
                <ModeBadge mode={toMode} />
              </div>

              <div className="bg-muted/40 rounded-xl p-4 text-sm space-y-1">
                {toMode === 'direct' ? (
                  <>
                    <p className="font-medium text-foreground">Pesos que serão mantidos:</p>
                    <p className="text-muted-foreground">Cimento: {fmt(preview.cementKg)} kg</p>
                    {Object.entries(target.materials_composition || {}).map(([k, c]) => (
                      <p key={k} className="text-muted-foreground">
                        {matName(k)}: {fmt(preview.weights[k] || 0)} kg ({c?.type === 'additive' ? 'aditivo' : 'agregado'})
                      </p>
                    ))}
                    <p className="text-xs text-muted-foreground/70 pt-1">Peso total da mistura: {fmt(preview.total)} kg · Rótulo de proporção será zerado.</p>
                  </>
                ) : (
                  <>
                    <p className="font-medium text-foreground">Proporção calculada a partir dos pesos:</p>
                    <p className="font-mono text-foreground">{formatRatioLabel(aggParts)} (1 parte de cimento)</p>
                    <p className="text-xs text-muted-foreground/70 pt-1">A composição percentual dos materiais é mantida — apenas o rótulo e as partes de proporção são recalculados.</p>
                  </>
                )}
              </div>

              <p className="text-xs text-amber-600">
                Os valores serão recalculados e a conversão registrada no histórico do traço. Para voltar, alterne novamente nesta aba.
              </p>

              <div className="flex gap-3 pt-1">
                <button onClick={() => setTarget(null)} className="flex-1 border border-border rounded-lg py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
                <button onClick={confirmSwitch} disabled={saving} className="flex-1 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">
                  {saving ? 'Convertendo...' : 'Confirmar Conversão'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}