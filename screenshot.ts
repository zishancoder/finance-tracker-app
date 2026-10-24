import { parseAmount } from './expenses.ts';

export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function parseExpenseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  return year >= 1970 && localDate(date) === value ? date : null;
}

export function extractTransaction(text: string) {
  const lines = text.replace(/[\u00a0\u202f]/g, ' ').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const normalized = lines.join('\n');
  const blockedReason = /\b(failed|pending|processing|declined|cancelled|canceled|refunded)\b/i.test(normalized)
    ? 'This screenshot includes a failed, pending, or refunded payment. Add an expense only after the payment is completed.'
    : /\breceived\s+from\b|\b(?:money|payment)\s+received\b|\bcredited\b/i.test(normalized)
      ? 'This looks like money received, rather than an expense.' : '';

  // shortcut: read one INR transaction with English labels; add layout/language parsers when real screenshots require them.
  const amounts = new Set<number>();
  function amountValue(value: string) {
    if (value.includes(',') && !/^(?:\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})*,\d{3})(?:\.\d{1,2})?$/.test(value)) return null;
    return parseAmount(value.replace(/,/g, ''));
  }
  for (const match of normalized.matchAll(/(?:₹|\bINR\b|\bRs\.?)[\s:]*([0-9][0-9,]*(?:\.[0-9]{1,2})?)(?![\d.])/gi)) {
    const value = match[1];
    const cents = amountValue(value);
    if (cents) amounts.add(cents);
  }
  if (!amounts.size) {
    for (let index = 0; index < lines.length; index++) {
      if (/^(?:amount(?: paid)?|total(?: paid)?|you paid)\s*:?$/i.test(lines[index])) {
        const cents = amountValue(lines[index + 1] ?? '');
        if (cents) amounts.add(cents);
      }
    }
  }
  if (!amounts.size && /\b(paid|payment|sent|successful)\b/i.test(normalized)) {
    for (let index = 0; index < lines.length; index++) {
      if (!/^[0-9][0-9,]*(?:\.[0-9]{1,2})?$/.test(lines[index])) continue;
      if (/\b(id|utr|reference|ref|account|balance|cashback|rewards|transaction)\b/i.test(lines[index - 1] ?? '')) continue;
      const cents = amountValue(lines[index]);
      if (cents) amounts.add(cents);
    }
  }
  const unsupportedCurrency = /[$€£]|\b(?:USD|EUR|GBP)\b/i.test(normalized);
  const cents = !unsupportedCurrency && amounts.size === 1 ? [...amounts][0] : null;
  let title = '';
  for (let index = 0; index < lines.length; index++) {
    const match = /^(?:paid to|payment to|sent to|to)\b\s*[:\-]?\s*(.*)$/i.exec(lines[index]);
    if (!match) continue;
    const candidate = match[1] || lines[index + 1] || '';
    if (candidate && !/[₹@]/.test(candidate) && !/^\d/.test(candidate) && !/^(?:bank|account|mobile|contact|pay again)\b/i.test(candidate)) {
      title = candidate.slice(0, 80);
      break;
    }
  }

  const dates = new Set<string>();
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  function addDate(year: string, month: number, day: string) {
    const date = `${year}-${String(month).padStart(2, '0')}-${day.padStart(2, '0')}`;
    if (parseExpenseDate(date)) dates.add(date);
  }
  for (const match of normalized.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) addDate(match[1], Number(match[2]), match[3]);
  for (const match of normalized.matchAll(/\b(\d{1,2})[\s/.-]+(\d{1,2})[\s/.-]+(\d{4})\b/g)) addDate(match[3], Number(match[2]), match[1]);
  for (const match of normalized.matchAll(/\b(\d{1,2})\s+([A-Za-z]{3,9})[\s,]+(\d{4})\b/g)) addDate(match[3], months.indexOf(match[2].slice(0, 3).toLowerCase()) + 1, match[1]);
  for (const match of normalized.matchAll(/\b([A-Za-z]{3,9})\s+(\d{1,2})[\s,]+(\d{4})\b/g)) addDate(match[3], months.indexOf(match[1].slice(0, 3).toLowerCase()) + 1, match[2]);
  return {
    amount: cents === null ? '' : (cents / 100).toFixed(2),
    title,
    date: dates.size === 1 ? [...dates][0] : '',
    blockedReason,
    ambiguousAmount: amounts.size > 1,
    unsupportedCurrency,
  };
}
