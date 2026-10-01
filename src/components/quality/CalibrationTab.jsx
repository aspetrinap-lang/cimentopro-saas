import { Wrench, AlertTriangle } from 'lucide-react';

export default function CalibrationTab({ form, setField }) {
  const calibrationExpired = form.calibration_valid_until
    ? new Date(form.calibration_valid_until) < new Date()
    : false;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Wrench className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">1.5 Equipamento de Ensaio e Calibração</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Atualize os dados sempre que a calibração for renovada (anualmente). Estes dados ficam registrados no laudo.
        O sistema valida certificado + validade + classe de acurácia — nunca afirma calibração apenas pelo número do certificado.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-muted-foreground mb-1">Máquina de Ensaio</label>
          <input className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={form.test_equipment || ''}
            onChange={e => setField('test_equipment', e.target.value)}
            placeholder="Descrição da prensa / máquina de ensaio" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">ID da Prensa</label>
          <input className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={form.press_id || ''}
            onChange={e => setField('press_id', e.target.value)}
            placeholder="Identificação da prensa" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Nº de Série</label>
          <input className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={form.press_serial || ''}
            onChange={e => setField('press_serial', e.target.value)}
            placeholder="Número de série da prensa" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Calibração Nº</label>
          <input className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={form.calibration_number || ''}
            onChange={e => setField('calibration_number', e.target.value)}
            placeholder="Nº do certificado de calibração" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Data da Calibração</label>
          <input type="date"
            className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={form.calibration_date || ''}
            onChange={e => setField('calibration_date', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Validade da Calibração</label>
          <input type="date"
            className={`w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring ${calibrationExpired ? 'border-red-400' : 'border-input'}`}
            value={form.calibration_valid_until || ''}
            onChange={e => setField('calibration_valid_until', e.target.value)} />
          {calibrationExpired && (
            <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Calibração vencida
            </p>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Classe de Acurácia</label>
          <input className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={form.equipment_accuracy_class || ''}
            onChange={e => setField('equipment_accuracy_class', e.target.value)}
            placeholder="Ex: Classe 1, Classe 0.5" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-muted-foreground mb-1">Emitente</label>
          <input className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={form.calibration_issuer || ''}
            onChange={e => setField('calibration_issuer', e.target.value)}
            placeholder="Emitente do certificado" />
        </div>
      </div>
    </section>
  );
}