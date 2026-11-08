// Utilitário central de fuso horário oficial de Brasília (America/Sao_Paulo / UTC-3)
export const BRASILIA_TZ = 'America/Sao_Paulo';

/**
 * Normaliza datas do SQLite ou ISO para objeto Date UTC correto.
 * Strings SQLite sem 'Z' nem offset como 'YYYY-MM-DD HH:MM:SS' foram geradas
 * em UTC pelo CURRENT_TIMESTAMP e devem ter o sufixo 'Z' para interpretação correta.
 */
export function parseUtcSqliteDate(val) {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  let s = String(val).trim();
  if (!s) return null;
  if (/^\d{10,13}$/.test(s)) {
    const d = new Date(Number(s));
    return isNaN(d.getTime()) ? null : d;
  }
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) {
    s = s.replace(' ', 'T') + 'Z';
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Retorna a data e hora formatada em horário oficial de Brasília (pt-BR, America/Sao_Paulo)
 */
export function formatBrasiliaDateTime(val, options = {}) {
  const d = parseUtcSqliteDate(val) || (val instanceof Date ? val : new Date());
  if (isNaN(d.getTime())) return String(val || '-');
  return d.toLocaleString('pt-BR', {
    timeZone: BRASILIA_TZ,
    ...options
  });
}

/**
 * Retorna somente a data formatada em horário oficial de Brasília
 */
export function formatBrasiliaDate(val, options = {}) {
  const d = parseUtcSqliteDate(val) || (val instanceof Date ? val : new Date());
  if (isNaN(d.getTime())) return String(val || '-');
  return d.toLocaleDateString('pt-BR', {
    timeZone: BRASILIA_TZ,
    ...options
  });
}

/**
 * Retorna somente a hora formatada em horário oficial de Brasília
 */
export function formatBrasiliaTime(val, options = {}) {
  const d = parseUtcSqliteDate(val) || (val instanceof Date ? val : new Date());
  if (isNaN(d.getTime())) return String(val || '-');
  return d.toLocaleTimeString('pt-BR', {
    timeZone: BRASILIA_TZ,
    ...options
  });
}

/**
 * Retorna um objeto com informações completas do horário atual de Brasília
 */
export function getBrasiliaNow() {
  const now = new Date();
  return {
    iso: now.toISOString(),
    timezone: BRASILIA_TZ,
    formatted: formatBrasiliaDateTime(now),
    date: formatBrasiliaDate(now),
    time: formatBrasiliaTime(now),
    timestamp: now.getTime()
  };
}

