import { Fragment, useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Search, ScrollText, ChevronDown, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const ACTION_STYLES = {
  CREATE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  UPDATE: 'bg-sky-50 text-sky-700 border-sky-200',
  DELETE: 'bg-red-50 text-red-700 border-red-200',
  LOGIN: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  LOGOUT: 'bg-slate-100 text-slate-500 border-slate-200',
  PERMISSION_CHANGE: 'bg-amber-50 text-amber-700 border-amber-200',
  COMPANY_STATUS_CHANGE: 'bg-purple-50 text-purple-700 border-purple-200',
};

const ACTION_LABELS = {
  CREATE: 'Criação',
  UPDATE: 'Alteração',
  DELETE: 'Exclusão',
  LOGIN: 'Login',
  LOGOUT: 'Logout',
  PERMISSION_CHANGE: 'Permissão',
  COMPANY_STATUS_CHANGE: 'Status empresa',
};

function ActionBadge({ action }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium whitespace-nowrap ${ACTION_STYLES[action] || 'bg-slate-100 text-slate-500 border-slate-200'}`}>
      {ACTION_LABELS[action] || action}
    </span>
  );
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

function ValueBlock({ label, value }) {
  const empty = !value || Object.keys(value).length === 0;
  return (
    <div className="flex-1 min-w-0">
      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      {empty ? (
        <p className="text-xs text-slate-400">—</p>
      ) : (
        <pre className="text-[11px] text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap break-all max-h-64 overflow-y-auto">
          {JSON.stringify(value, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default function AdminAudit() {
  const [logs, setLogs] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [entity, setEntity] = useState('');
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    Promise.all([
      base44.entities.AuditLog.list('-created_date', 500),
      base44.entities.Company.list('name', 500).catch(() => []),
    ]).then(([l, c]) => {
      setLogs(l);
      setCompanies(c);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const companyNames = useMemo(() => {
    const m = {};
    companies.forEach((c) => { m[c.id] = c.name; });
    return m;
  }, [companies]);

  const entityOptions = useMemo(
    () => [...new Set(logs.map((l) => l.entity_name).filter(Boolean))].sort(),
    [logs]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((l) => {
      if (action && l.action !== action) return false;
      if (entity && l.entity_name !== entity) return false;
      if (!q) return true;
      return [l.user_email, l.entity_name, l.entity_id, l.action].some((v) => (v || '').toLowerCase().includes(q));
    });
  }, [logs, search, action, entity]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <ScrollText className="w-6 h-6 text-indigo-600" /> Auditoria
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Registro das operações importantes da plataforma — quem fez, o que fez, em qual empresa e o que mudou
        </p>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por usuário, entidade, registro..."
            className="pl-9 bg-white"
          />
        </div>
        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700"
        >
          <option value="">Todas as ações</option>
          {Object.keys(ACTION_LABELS).map((a) => (
            <option key={a} value={a}>{ACTION_LABELS[a]}</option>
          ))}
        </select>
        <select
          value={entity}
          onChange={(e) => setEntity(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700"
        >
          <option value="">Todas as entidades</option>
          {entityOptions.map((en) => (
            <option key={en} value={en}>{en}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500 text-sm">
          Nenhum registro de auditoria encontrado.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className="w-8" />
                <TableHead className="text-slate-500">Data/Hora</TableHead>
                <TableHead className="text-slate-500">Usuário</TableHead>
                <TableHead className="text-slate-500">Empresa</TableHead>
                <TableHead className="text-slate-500">Ação</TableHead>
                <TableHead className="text-slate-500">Entidade</TableHead>
                <TableHead className="text-slate-500">Registro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((l) => (
                <Fragment key={l.id}>
                  <TableRow
                    className="cursor-pointer"
                    onClick={() => setOpenId(openId === l.id ? null : l.id)}
                  >
                    <TableCell className="text-slate-400">
                      {openId === l.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </TableCell>
                    <TableCell className="text-slate-600 text-xs whitespace-nowrap">{fmtDate(l.created_date)}</TableCell>
                    <TableCell className="text-slate-800 text-sm" title={l.user_id || ''}>
                      {l.user_email || l.user_id || '—'}
                    </TableCell>
                    <TableCell className="text-slate-600 text-sm whitespace-nowrap">
                      {companyNames[l.company_id] || l.company_id || '—'}
                    </TableCell>
                    <TableCell><ActionBadge action={l.action} /></TableCell>
                    <TableCell className="text-slate-600 text-sm">{l.entity_name || '—'}</TableCell>
                    <TableCell className="text-slate-500 text-xs font-mono">{l.entity_id || '—'}</TableCell>
                  </TableRow>
                  {openId === l.id && (
                    <TableRow className="bg-slate-50/60 hover:bg-slate-50/60">
                      <TableCell colSpan={7}>
                        <div className="flex flex-col sm:flex-row gap-4 py-1">
                          <ValueBlock label="Antes" value={l.old_value} />
                          <ValueBlock label="Depois" value={l.new_value} />
                        </div>
                        {l.ip && <p className="text-[11px] text-slate-400 mt-2">IP: {l.ip}</p>}
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}