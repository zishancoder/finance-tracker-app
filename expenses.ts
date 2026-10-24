export const categories = ['Food', 'Transport', 'Shopping', 'Bills', 'Other'] as const;
export type Category = (typeof categories)[number];
export type Expense = { id: string; title: string; cents: number; category: Category; date: string };

export function parseAmount(value: string): number | null {
  const match = /^(\d{1,8})(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return cents > 0 ? cents : null;
}

export function expenseTotal(expenses: Expense[]): number {
  const total = expenses.reduce((sum, expense) => sum + expense.cents, 0);
  if (!Number.isSafeInteger(total)) throw new Error('Expense total is too large');
  return total;
}

export function readExpenses(value: string | null): Expense[] {
  if (value === null) return [];
  const data: unknown = JSON.parse(value);
  if (!Array.isArray(data) || !data.every((item) =>
    item && typeof item.id === 'string' && item.id.length > 0 && item.id.length <= 128 && typeof item.title === 'string' &&
    item.title.trim().length > 0 && item.title.length <= 80 && Number.isSafeInteger(item.cents) && item.cents > 0 &&
    categories.includes(item.category) && typeof item.date === 'string' && Number.isFinite(Date.parse(item.date)) && new Date(item.date).toISOString() === item.date
  ) || new Set(data.map((item) => item.id)).size !== data.length) throw new Error('Invalid saved expenses');
  expenseTotal(data);
  return data.map(({ id, title, cents, category, date }) => ({ id, title, cents, category, date }));
}

export const MAX_BACKUP_SIZE = 5 * 1024 * 1024;

export function exportBackup(expenses: Expense[]): string {
  const backup = JSON.stringify({ app: 'finance-tracker', version: 1, currency: 'INR', exportedAt: new Date().toISOString(), expenses }, null, 2);
  if (new TextEncoder().encode(backup).length > MAX_BACKUP_SIZE) throw new Error('Backups can be up to 5 MB.');
  return backup;
}

export function importBackup(text: string, existing: Expense[]): Expense[] {
  if (text.length > MAX_BACKUP_SIZE) throw new Error('Choose a backup smaller than 5 MB.');
  let backup;
  try { backup = JSON.parse(text); } catch { throw new Error('This file is not valid JSON.'); }
  if (!backup || backup.app !== 'finance-tracker' || backup.version !== 1 || backup.currency !== 'INR' || !Array.isArray(backup.expenses)) {
    throw new Error('Choose a Finance Tracker JSON backup in INR (version 1).');
  }
  let incoming: Expense[];
  try { incoming = readExpenses(JSON.stringify(backup.expenses)); }
  catch { throw new Error('The backup contains invalid expenses. Nothing was imported.'); }
  const merged = new Map(existing.map((item) => [item.id, item]));
  for (const item of incoming) {
    const previous = merged.get(item.id);
    if (previous && (['title', 'cents', 'category', 'date'] as const).some((key) => previous[key] !== item[key])) {
      throw new Error('A backup expense conflicts with an existing expense. Nothing was imported.');
    }
    merged.set(item.id, item);
  }
  const result = [...merged.values()].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  expenseTotal(result);
  return result;
}

export function expensesForMonth(expenses: Expense[], month: Date): Expense[] {
  return expenses.filter(({ date }) => {
    const day = new Date(date);
    return day.getFullYear() === month.getFullYear() && day.getMonth() === month.getMonth();
  });
}

export function shiftMonth(month: Date, offset: number): Date {
  return new Date(month.getFullYear(), month.getMonth() + offset, 1);
}

export const money = (cents: number) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(cents / 100);
