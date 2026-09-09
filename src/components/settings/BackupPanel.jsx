import { useState, useRef, useEffect } from 'react';
import {
  exportAllData, downloadBackup, importAllData,
  runDailyBackup, getLocalBackupInfo, clearLocalBackup,
  BACKUP_ENTITIES, BACKUP_VERSION,
} from '@/lib/backupUtils';
import {
  Download, Upload, Database, RefreshCw, AlertTriangle,
  CheckCircle2, Calendar, HardDrive, Trash2,
} from 'lucide-react';

const ENTITY_LABELS = {
  Machine: 'Máquinas',
  Mold: 'Moldes',
  ProductType: 'Artefatos',
  ConcreteTrace: 'Traços de Concreto',
  FailurePattern: 'Padrões de Falha',
  AppSettings: 'Configurações',
  ProductionOrder: 'Ordens de Produção',
  MachineDowntime: 'Paradas de Máquina',
  PreventiveMaintenance: 'Manutenção Preventiva',
  MonthlyDre: 'DRE Mensal',
  ProductionLine: 'Linhas de Produção',
  SharedResource: 'Recursos Compartilhados',
  QualityReport: 'Laudos de Qualidade',
  UserRoleProfile: 'Perfis de Acesso',
  UserPin: 'Operadores (PIN)',
  ProductCategory: 'Categorias de Produto',
  ArtifactModel: 'Modelos de Artefato',
};

export default function BackupPanel() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [replaceMode, setReplaceMode] = useState(false);
  const [localInfo, setLocalInfo] = useState({ exists: false });
  const [importResult, setImportResult] = useState(null);
  const [error, setError] = useState(null);
  const [backupRunning, setBackupRunning] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => { refreshLocalInfo(); }, []);

  function refreshLocalInfo() {
    setLocalInfo(getLocalBackupInfo());
  }

  async function handleDownload() {
    setExporting(true);
    setError(null);
    try {
      const data = await exportAllData();
      downloadBackup(data);
    } catch (e) {
      setError(e.message);
    }
    setExporting(false);
  }

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    setError(null);
    setImportResult(null);
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      if (!backup.data) throw new Error('Arquivo de backup inválido.');
      const result = await importAllData(backup, { replace: replaceMode });
      setImportResult(result);
    } catch (e) {
      setError(e.message);
    }
    setImporting(false);
    e.target.value = '';
  }

  async function handleManualBackup() {
    setBackupRunning(true);
    setError(null);
    try {
      clearLocalBackup();
      await runDailyBackup();
      refreshLocalInfo();
    } catch (e) {
      setError(e.message);
    }
    setBackupRunning(false);
  }

  function handleClearLocal() {
    clearLocalBackup();
    refreshLocalInfo();
  }

  const totalRecords = localInfo.exists
    ? Object.values(localInfo.counts).reduce((a, b) => a + (b || 0), 0)
    : 0;

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-start gap-3 bg-destructive/10 border border-destructive/20 rounded-xl p-4">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-destructive">Erro</p>
            <p className="text-xs text-destructive/80 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {importResult && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <p className="text-sm font-medium text-green-800">Importação concluída</p>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {BACKUP_ENTITIES.map(e => (
              <div key={e} className="flex justify-between text-xs bg-white/60 rounded-md px-3 py-1.5">
                <span className="text-muted-foreground">{ENTITY_LABELS[e]}</span>
                <span className="font-medium text-green-700">{importResult[e] || 0} registros</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Download */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
            <Download className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-foreground">Download dos Dados</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Exporta todos os dados do aplicativo em um arquivo JSON para guardar no seu dispositivo.
              <span className="ml-1 text-[10px] bg-muted px-1.5 py-0.5 rounded font-medium">v{BACKUP_VERSION}</span>
            </p>
            <button
              onClick={handleDownload}
              disabled={exporting}
              className="mt-3 flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {exporting ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Exportando...</>
              ) : (
                <><Download className="w-4 h-4" /> Baixar Backup</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Upload */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
            <Upload className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-foreground">Upload dos Dados</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Importa dados de um arquivo de backup JSON. Selecione o modo de importação abaixo.
            </p>

            <label className="flex items-center gap-3 mt-3 cursor-pointer">
              <button
                type="button"
                onClick={() => setReplaceMode(!replaceMode)}
                className={`relative w-10 h-5 rounded-full transition-colors ${replaceMode ? 'bg-amber-500' : 'bg-muted'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${replaceMode ? 'translate-x-5' : ''}`} />
              </button>
              <span className="text-xs text-muted-foreground">
                {replaceMode ? 'Substituir dados existentes' : 'Adicionar aos dados existentes'}
              </span>
            </label>

            {replaceMode && (
              <div className="flex items-start gap-2 mt-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  Todos os registros atuais serão excluídos antes de importar. Esta ação não pode ser desfeita.
                </p>
              </div>
            )}

            <input ref={fileRef} type="file" accept=".json" onChange={handleUpload} className="hidden" />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={importing}
              className="mt-3 flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {importing ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Importando...</>
              ) : (
                <><Upload className="w-4 h-4" /> Selecionar Arquivo</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Backup local diário */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
            <HardDrive className="w-5 h-5 text-green-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">Backup Diário no Dispositivo</h2>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Automático</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Uma cópia local é salva automaticamente neste dispositivo todos os dias.
            </p>

            {localInfo.exists ? (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5" />
                  Último backup: <span className="font-medium text-foreground">{localInfo.date}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Database className="w-3.5 h-3.5" />
                  {totalRecords} registros · {localInfo.size} KB
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {BACKUP_ENTITIES.filter(e => (localInfo.counts[e] || 0) > 0).map(e => (
                    <div key={e} className="flex justify-between text-xs bg-muted/50 rounded-md px-3 py-1.5">
                      <span className="text-muted-foreground">{ENTITY_LABELS[e]}</span>
                      <span className="font-medium text-foreground">{localInfo.counts[e]}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleManualBackup}
                    disabled={backupRunning}
                    className="flex items-center gap-2 border border-border rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-60"
                  >
                    {backupRunning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    Atualizar agora
                  </button>
                  <button
                    onClick={handleClearLocal}
                    className="flex items-center gap-2 border border-border rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Limpar
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <p className="text-xs text-muted-foreground mb-3">Nenhum backup local encontrado.</p>
                <button
                  onClick={handleManualBackup}
                  disabled={backupRunning}
                  className="flex items-center gap-2 border border-border rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-60"
                >
                  {backupRunning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Criar backup agora
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}