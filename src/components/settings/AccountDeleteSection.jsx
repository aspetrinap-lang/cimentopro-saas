import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useOperator } from '@/lib/OperatorContext';
import { Trash2, AlertTriangle, X } from 'lucide-react';

const CONFIRM_WORD = 'EXCLUIR';

export default function AccountDeleteSection() {
  const { logout } = useAuth();
  const { clearOperator } = useOperator();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (text.trim().toUpperCase() !== CONFIRM_WORD) return;
    setDeleting(true);
    try {
      clearOperator();
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('cimentopro_') || k === 'theme') localStorage.removeItem(k);
      });
    } catch (e) {
      // ignora falhas de limpeza local
    }
    setDeleting(false);
    logout(true);
  }

  const canDelete = text.trim().toUpperCase() === CONFIRM_WORD;

  return (
    <div className="mt-8 border border-destructive/30 rounded-xl p-5 bg-destructive/5">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-4 h-4 text-destructive" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-foreground">Zona de Exclusão</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Remove o seu acesso e todos os dados locais deste dispositivo. Esta ação não pode ser desfeita.
          </p>
          <button
            onClick={() => setOpen(true)}
            className="mt-3 flex items-center gap-2 border border-destructive/40 text-destructive px-4 py-2 rounded-lg text-sm font-medium hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" /> Excluir Conta
          </button>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-semibold text-foreground text-destructive">Excluir Conta</h2>
              <button onClick={() => { setOpen(false); setText(''); }} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-destructive/90">
                  Você perderá o acesso neste dispositivo. Todos os dados locais (operador, configurações e backups salvos) serão removidos e a sessão será encerrada.
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Para confirmar, digite <strong className="text-foreground">{CONFIRM_WORD}</strong>
                </label>
                <input
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring uppercase tracking-wider"
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder="EXCLUIR"
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setOpen(false); setText(''); }}
                  className="flex-1 border border-border rounded-lg py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
                  Cancelar
                </button>
                <button onClick={handleDelete} disabled={deleting || !canDelete}
                  className="flex-1 bg-destructive text-destructive-foreground rounded-lg py-2.5 text-sm font-medium hover:bg-destructive/90 transition-colors disabled:opacity-50">
                  {deleting ? 'Excluindo...' : 'Excluir Definitivamente'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}