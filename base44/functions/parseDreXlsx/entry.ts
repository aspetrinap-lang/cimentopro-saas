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

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const fileUrl = body.file_url;
    if (!fileUrl) return Response.json({ error: 'file_url é obrigatório' }, { status: 400 });

    const resp = await fetch(fileUrl);
    if (!resp.ok) return Response.json({ error: 'Falha ao baixar o arquivo' }, { status: 502 });
    const buf = await resp.arrayBuffer();
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