// Formatação central de datas — padrão dia/mês/ano (dd/MM/aaaa) em todo o app.
// Aceita 'YYYY-MM-DD', ISO completo ('YYYY-MM-DDTHH:mm:ssZ') ou Date.
export function formatDateBR(value) {
  if (value == null || value === '') return '—';
  const s = value instanceof Date ? value.toISOString() : String(value);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return s;
  // ISO com horário: converte para horário local para não deslocar o dia
  if (s.includes('T')) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    }
  }
  return `${m[3]}/${m[2]}/${m[1]}`;
}

// Data + hora (dd/MM/aaaa HH:mm) — usada em registros com timestamp (created_date etc.)
export function formatDateTimeBR(value) {
  if (value == null || value === '') return '—';
  const s = value instanceof Date ? value.toISOString() : String(value);
  const date = formatDateBR(s);
  if (!s.includes('T')) return date;
  const d = new Date(s);
  if (isNaN(d.getTime())) return date;
  return `${date} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}