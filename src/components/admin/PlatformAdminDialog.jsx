import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { X, AlertTriangle } from 'lucide-react';

// Dupla confirmação para promover/rebaixar SUPER_ADMIN: é preciso digitar o
// e-mail do alvo exatamente. Toda mudança é registrada na auditoria
// (PERMISSION_CHANGE) e o usuário alvo precisa sair e entrar novamente.
export default function PlatformAdminDialog({ user, onClose, onDone }) {
  const { toast } = useToast();
  const [confirmEmail, setConfirmEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const promote = !user.is_platform_admin;
  const targetEmail = (user.email || '').trim().toLowerCase();
  const typed = confirmEmail.trim().toLowerCase();
  const matches = typed.length > 0 && typed === targetEmail;

  async function handleConfirm() {
    setBusy(true);
    try {
      await base44.functions.invoke('adminUsers', {
        action: 'setPlatformAdmin',
        user_id: user.id,
        active: promote,
        confirm_email: confirmEmail.trim(),
      });
      toast({
        title: promote ? 'Usuário promovido a SUPER_ADMIN' : 'SUPER_ADMIN rebaixado',
        description: `${user.email} precisa sair e entrar novamente para a sessão refletir a mudança.`,
      });
      await onDone?.();
      onClose();
    } catch (e) {
      toast({ title: 'Não foi possível concluir', description: e?.response?.data?.error || e.message, variant: 'destructive' });
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{promote ? 'Promover a SUPER_ADMIN' : 'Rebaixar SUPER_ADMIN'}</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {user.full_name || user.email} · <span className="font-medium text-slate-700">{user.email}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>
        </div>

        <p className="text-sm text-slate-600 mt-4 leading-relaxed">
          {promote
            ? 'O usuário terá acesso total à plataforma: empresas, usuários, auditoria, planos e assinaturas.'
            : 'O usuário perderá o acesso administrativo à plataforma; seus vínculos de empresa não mudam.'}
        </p>

        <label className="block text-xs font-semibold text-slate-700 mt-4 mb-1.5">
          Para confirmar, digite o e-mail do usuário: <span className="font-bold">{user.email}</span>
        </label>
        <input
          value={confirmEmail}
          onChange={(e) => setConfirmEmail(e.target.value)}
          placeholder={user.email}
          className={`w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 ${
            matches ? 'border-emerald-300 focus:ring-emerald-200' : 'border-slate-200 focus:ring-indigo-200'
          }`}
          autoFocus
        />

        <div className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3 mt-3">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-600 leading-relaxed">
            A mudança é registrada na auditoria da plataforma. O usuário precisa <strong>sair e entrar novamente</strong> para a sessão refletir o novo status.
          </p>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">Cancelar</button>
          <button
            onClick={handleConfirm}
            disabled={!matches || busy}
            className={`px-4 py-2 text-sm rounded-lg text-white font-medium disabled:opacity-50 ${
              promote ? 'bg-amber-600 hover:bg-amber-700' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {busy ? 'Confirmando...' : promote ? 'Promover' : 'Rebaixar'}
          </button>
        </div>
      </div>
    </div>
  );
}