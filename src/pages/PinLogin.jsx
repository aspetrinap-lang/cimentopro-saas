import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useOperator } from '@/lib/OperatorContext';
import { ROLE_LABELS, getAllowedPaths, getAllowedPathsForOperator } from '@/lib/permissions';
import { Factory, ArrowLeft, Delete, ShieldCheck } from 'lucide-react';

export default function PinLogin() {
  const navigate = useNavigate();
  const { setActiveOperator } = useOperator();
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    base44.entities.UserPin.filter({ active: true }, 'name')
      .then((list) => { setOperators(list); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function press(d) {
    setError('');
    setPin((p) => (p.length < 4 ? p + d : p));
  }
  function backspace() {
    setError('');
    setPin((p) => p.slice(0, -1));
  }

  useEffect(() => {
    if (pin.length === 4 && selected) {
      if (pin === selected.pin) {
        // Busca o perfil de acesso vinculado (se houver) para resolver as permissões.
        base44.entities.UserRoleProfile.get(selected.profile_id)
          .then((profile) => {
            const operator = {
              id: selected.id,
              name: selected.name,
              email: selected.email,
              role: selected.role,
              profile_id: selected.profile_id,
              permissions: profile?.permissions || null,
            };
            setActiveOperator(operator);
            navigate(getAllowedPathsForOperator(operator)[0] || '/orders');
          })
          .catch(() => {
            const operator = {
              id: selected.id,
              name: selected.name,
              email: selected.email,
              role: selected.role,
              profile_id: selected.profile_id,
              permissions: null,
            };
            setActiveOperator(operator);
            navigate(getAllowedPaths(operator.role)[0]);
          });
      } else {
        setError('PIN incorreto');
        setTimeout(() => setPin(''), 250);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, selected, setActiveOperator, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-3">
            <Factory className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">CimentoPro</h1>
          <p className="text-sm text-muted-foreground mt-1">Selecione o operador e informe o PIN</p>
        </div>

        <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
          {!selected ? (
            loading ? (
              <div className="flex justify-center py-10">
                <div className="w-7 h-7 border-4 border-muted border-t-primary rounded-full animate-spin" />
              </div>
            ) : operators.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">Nenhum operador cadastrado.</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Um administrador deve cadastrar operadores em Configurações → Operadores.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {operators.map((op) => (
                  <button
                    key={op.id}
                    onClick={() => { setSelected(op); setPin(''); setError(''); }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                      {op.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground text-sm truncate">{op.name}</p>
                      <p className="text-xs text-muted-foreground">{ROLE_LABELS[op.role] || op.role}</p>
                    </div>
                  </button>
                ))}
              </div>
            )
          ) : (
            <div className="space-y-5">
              <button onClick={() => { setSelected(null); setPin(''); setError(''); }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" /> Trocar operador
              </button>
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl mx-auto">
                  {selected.name.charAt(0).toUpperCase()}
                </div>
                <p className="font-semibold text-foreground mt-2">{selected.name}</p>
                <p className="text-xs text-muted-foreground">{ROLE_LABELS[selected.role] || selected.role}</p>
              </div>
              <div className="flex justify-center gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className={`w-4 h-4 rounded-full border-2 ${pin.length > i ? 'bg-primary border-primary' : 'border-border'}`} />
                ))}
              </div>
              {error && <p className="text-center text-sm text-destructive">{error}</p>}
              <div className="grid grid-cols-3 gap-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                  <button key={d} onClick={() => press(d)} className="h-14 rounded-xl border border-border bg-background hover:bg-muted font-semibold text-lg transition-colors">{d}</button>
                ))}
                <button onClick={backspace} className="h-14 rounded-xl border border-border bg-background hover:bg-muted flex items-center justify-center transition-colors">
                  <Delete className="w-5 h-5" />
                </button>
                <button onClick={() => press('0')} className="h-14 rounded-xl border border-border bg-background hover:bg-muted font-semibold text-lg transition-colors">0</button>
                <div />
              </div>
            </div>
          )}

          <div className="mt-5 pt-4 border-t border-border">
            <button onClick={() => navigate('/')} className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ShieldCheck className="w-4 h-4" /> Continuar como Administrador
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}