import * as XLSX from 'npm:xlsx@0.18.5';
import { createClientFromRequest } from 'npm:@base44/sdk';

const MONTH_MAP = {
  JANEIRO: 1, FEVEREIRO: 2, MARCO: 3, MARÇO: 3, ABRIL: 4, MAIO: 5, JUNHO: 6,
  JULHO: 7, AGOSTO: 8, SETEMBRO: 9, OUTUBRO: 10, NOVEMBRO: 11, DEZEMBRO: 12,
};

function toNumber(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return isNaN(v) ? null : v;
  const s = String(v).trim().replace(/\./g, '').replace(',', '.').replace(/[^\d.\-]/g, '');
  if (!s) return null;
  const n = Number(s);
  return isNaN(n) ? null : n;
}

function monthNumber(name) {
  const key = String(name).trim().toUpperCase().replace(/[ÁÀÂÃ]/g, 'A').replace(/[ÉÊ]/g, 'E').replace(/[Í]/g, 'I').replace(/[ÓÔÕ]/g, 'O').replace(/[ÚÛ]/g, 'U');
  return MONTH_MAP[key] || null;
}

// Linha de subtotal: prefixo ( + ), ( - ), ( = ) ou palavra-chave de totalização.
// Essas linhas não entram como contas (evita somar em duplicidade); o faturamento
// é lido diretamente da linha "Receitas Operacionais" (subtotal).
function isSubtotalLine(name) {
  const n = String(name || '').trim();
  if (!n) return false;
  if (/^\(\s*[+\-=]\s*\)/.test(n)) return true;
  const u = n.toUpperCase();
  if (/\b(TOTAL|BRUTA|BRUTO|LIQUIDA|L[ÍI]QUIDA|L[ÍI]QUIDO|LIQUIDO|SUBTOTAL|LUCRO|MARGEM|EBITDA|RESULTADO)\b/.test(u)) return true;
  return false;
}

// Localiza a linha de faturamento (Receitas Operacionais) entre os subtotais.
function findFaturamento(subtotals) {
  const clean = s => String(s || '').replace(/^\(\s*[+\-=]\s*\)\s*/, '').trim().toUpperCase().replace(/\s+/g, ' ');
  let f = subtotals.find(s => /^RECEITAS?\s+OPERACIONAIS?\s*$/.test(clean(s.account_name)));
  if (!f) f = subtotals.find(s => /^RECEITA\s+OPERACIONAL\s+BRUTA\s*$/.test(clean(s.account_name)));
  if (!f) f = subtotals.find(s => /RECEITAS?\s+OPERACIONAIS?/.test(clean(s.account_name)) && !/^OUTRAS/.test(clean(s.account_name)));
  return f;
}

// --- Proteção SSRF (CWE-918): nenhuma URL é buscada sem passar por estas validações ---
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_REDIRECTS = 3;

// Faixas IPv4 reservadas/privadas/locais — nunca podem ser destino de fetch
const BLOCKED_V4_RANGES = [
  [0x00000000, 0x000000ff], // 0.0.0.0/8
  [0x0a000000, 0x0affffff], // 10.0.0.0/8
  [0x64400000, 0x647fffff], // 100.64.0.0/10 (CGNAT)
  [0x7f000000, 0x7fffffff], // 127.0.0.0/8 (loopback)
  [0xa9fe0000, 0xa9feffff], // 169.254.0.0/16 (link-local / cloud metadata)
  [0xac100000, 0xac1fffff], // 172.16.0.0/12 (privada)
  [0xc0000000, 0xc00000ff], // 192.0.0.0/24
  [0xc0a80000, 0xc0a8ffff], // 192.168.0.0/16 (privada)
  [0xc6120000, 0xc613ffff], // 198.18.0.0/15 (benchmark)
  [0xe0000000, 0xefffffff], // 224.0.0.0/4 (multicast)
  [0xf0000000, 0xffffffff], // 240.0.0.0/4 (reservada)
];

function ipv4ToLong(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return null;
  return parts.reduce((n, o) => n * 256 + o, 0);
}

function isBlockedIPv4(ip) {
  const n = ipv4ToLong(ip);
  return n == null || BLOCKED_V4_RANGES.some(([lo, hi]) => n >= lo && n <= hi);
}

function isBlockedIPv6(ip) {
  const h = String(ip).toLowerCase();
  return h === '::1' || h === '::' || h.startsWith('fc') || h.startsWith('fd') ||
    ['fe8', 'fe9', 'fea', 'feb'].some((p) => h.startsWith(p));
}

// Storage oficial da plataforma (domínios confirmados em uploads reais do
// Core.UploadFile/UploadPublicFile): o endpoint base44.app responde 302 para o
// CDN media.base44.com. Dentro do runtime o DNS é split-horizon (resolve para
// IP interno da própria infra), então os hosts autorizados são isentos do
// check de IP privado — mas continuam sujeitos a scheme, credenciais, porta e
// IP-literal. Qualquer outro host passa pelo check de DNS completo.
const ALLOWED_STORAGE_HOSTS = ['base44.app', 'media.base44.com'];

function isAllowedStorageHost(host) {
  return ALLOWED_STORAGE_HOSTS.some((allowed) => host === allowed || host.endsWith('.' + allowed));
}

// Valida a URL antes de qualquer fetch: scheme, credenciais, porta, hostname
// e (quando disponível no runtime) o IP resolvido por DNS — protege contra
// DNS rebinding. Fail-open apenas se a API de DNS não existir no runtime.
async function isAllowedUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  if (url.username || url.password) return false;
  if (url.port && url.port !== '443') return false;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost')) return false;
  if (host.includes(':')) return false; // IP literal IPv6 — bloqueado
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    if (isBlockedIPv4(host)) return false;
    return true;
  }
  // Storage oficial: host conhecido, DNS split-horizon esperado — isento do
  // check de IP privado, mas não das demais validações.
  if (isAllowedStorageHost(host)) return true;
  // Demais hosts: valida o IP resolvido por DNS (proteção contra rebinding).
  const resolveDns = typeof Deno !== 'undefined' && typeof Deno.resolveDns === 'function' ? Deno.resolveDns : null;
  if (resolveDns) {
    try {
      const [aRecs, aaaaRecs] = await Promise.all([
        resolveDns(host, 'A').catch(() => []),
        resolveDns(host, 'AAAA').catch(() => []),
      ]);
      if ((aRecs || []).some(isBlockedIPv4)) return false;
      if ((aaaaRecs || []).some(isBlockedIPv6)) return false;
    } catch {
      return false;
    }
  }
  return true;
}

// Fetch que nunca segue redirects sozinho: cada hop é revalidado com isAllowedUrl.
async function fetchValidatedUrl(rawUrl) {
  let current = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!(await isAllowedUrl(current))) return null;
    let resp;
    try {
      resp = await fetch(current, { redirect: 'manual' });
    } catch {
      return null;
    }
    if (resp.status >= 300 && resp.status < 400) {
      const location = resp.headers.get('location');
      if (!location) return null;
      try {
        current = new URL(location, current).href;
      } catch {
        return null;
      }
      continue;
    }
    return resp;
  }
  return null;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const fileUrl = body.file_url;
    if (!fileUrl || typeof fileUrl !== 'string') return Response.json({ error: 'file_url é obrigatório' }, { status: 400 });

    // SSRF: só passam daqui URLs https públicas, sem credenciais/portas
    // exóticas, com IP resolvido público e redirects revalidados hop a hop.
    const resp = await fetchValidatedUrl(fileUrl);
    if (!resp) return Response.json({ error: 'URL de arquivo não autorizada.' }, { status: 400 });
    if (!resp.ok) return Response.json({ error: 'Falha ao baixar o arquivo' }, { status: 502 });

    const declaredLength = Number(resp.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_FILE_BYTES) {
      return Response.json({ error: 'Arquivo maior que o limite permitido.' }, { status: 413 });
    }
    const buf = await resp.arrayBuffer();
    if (buf.byteLength > MAX_FILE_BYTES) {
      return Response.json({ error: 'Arquivo maior que o limite permitido.' }, { status: 413 });
    }
    const wb = XLSX.read(buf, { type: 'array' });

    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
    if (rows.length < 3) return Response.json({ error: 'Planilha sem dados suficientes' }, { status: 400 });

    const headers = rows[0];
    const typeLabels = rows[1];

    let year = new Date().getFullYear();
    const titleCell = headers[0] ? String(headers[0]) : '';
    const yearMatch = titleCell.match(/20\d{2}/);
    if (yearMatch) year = parseInt(yearMatch[0], 10);

    const columns = [];
    for (let i = 1; i < headers.length; i++) {
      const h = headers[i];
      if (h == null) continue;
      const monthName = String(h).trim();
      if (!monthName || monthName === '%') continue;
      const mNum = monthNumber(monthName);
      if (!mNum) continue;
      const label = typeLabels[i] ? String(typeLabels[i]).trim().toUpperCase().replace(/\s+/g, '') : '';
      const type = label === 'ORÇADO' || label === 'ORCADO' ? 'orcado'
        : label === 'REALIZADO' ? 'realizado' : null;
      if (!type) continue;
      columns.push({ monthName, monthNum: mNum, type, index: i });
    }

    if (columns.length === 0) {
      return Response.json({ error: 'Não foi possível identificar colunas de meses com rótulos ORÇADO/REALIZADO.' }, { status: 422 });
    }

    const monthMap = new Map();
    for (const c of columns) {
      const key = c.monthName.toUpperCase();
      if (!monthMap.has(key)) {
        monthMap.set(key, {
          name: c.monthName,
          monthNum: c.monthNum,
          reference_month: `${year}-${String(c.monthNum).padStart(2, '0')}`,
          orcadoCol: null,
          realizadoCol: null,
        });
      }
      const m = monthMap.get(key);
      if (c.type === 'orcado') m.orcadoCol = c.index;
      else m.realizadoCol = c.index;
    }

    const months = Array.from(monthMap.values());
    const accountCol = 0;

    // Coleta linhas de dados por mês (a partir da linha 3, índice 2)
    const rawByMonth = {};
    for (const m of months) rawByMonth[m.reference_month] = [];

    for (let r = 2; r < rows.length; r++) {
      const row = rows[r];
      const accountRaw = row[accountCol];
      if (accountRaw == null) continue;
      const accountName = String(accountRaw).trim();
      if (!accountName) continue;
      for (const m of months) {
        const planned = m.orcadoCol != null ? toNumber(row[m.orcadoCol]) : null;
        const actual = m.realizadoCol != null ? toNumber(row[m.realizadoCol]) : null;
        if (planned == null && actual == null) continue;
        rawByMonth[m.reference_month].push({
          account_name: accountName,
          planned_value: planned ?? 0,
          actual_value: actual ?? 0,
        });
      }
    }

    // Separa detalhes de subtotais e calcula o faturamento (Receitas Operacionais)
    const itemsByMonth = {};
    const subtotalsByMonth = {};
    const faturamentoByMonth = {};
    for (const m of months) {
      const raw = rawByMonth[m.reference_month];
      const items = [];
      const subtotals = [];
      for (const r of raw) {
        if (isSubtotalLine(r.account_name)) subtotals.push(r);
        else items.push(r);
      }
      itemsByMonth[m.reference_month] = items;
      subtotalsByMonth[m.reference_month] = subtotals;
      const f = findFaturamento(subtotals);
      faturamentoByMonth[m.reference_month] = {
        planned_value: f ? f.planned_value : 0,
        actual_value: f ? f.actual_value : 0,
        account_name: f ? f.account_name : '',
      };
    }

    months.sort((a, b) => a.reference_month.localeCompare(b.reference_month));

    return Response.json({
      year,
      months: months.map((m) => ({
        name: m.name,
        reference_month: m.reference_month,
        has_orcado: m.orcadoCol != null,
        has_realizado: m.realizadoCol != null,
        items: itemsByMonth[m.reference_month],
        faturamento: faturamentoByMonth[m.reference_month],
      })),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}