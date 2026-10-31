export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function parseExpenseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  return year >= 1970 && localDate(date) === value ? date : null;
}

export const categories = ['Food', 'Transport', 'Shopping', 'Bills', 'Other'] as const;
export type Category = string;
export type Expense = { id: string; title: string; cents: number; category: Category; date: string };
export type Budgets = Record<string, number>;
export type TrackerData = { expenses: Expense[]; budgets: Budgets; categories: string[] };

export function categoryName(value: string, existing: readonly string[]): string {
  const name = value.trim();
  if (!name || name.length > 30 || /[\u0000-\u001f\u007f]/.test(name)) throw new Error('Enter a category name of 1–30 characters.');
  if (existing.some((item) => item.toLowerCase() === name.toLowerCase())) throw new Error('A category with this name already exists.');
  return name;
}

export function readCategories(value: unknown): string[] {
  if (!Array.isArray(value)) throw new Error('Invalid saved categories');
  const result: string[] = [];
  for (const name of value) {
    if (typeof name !== 'string' || categoryName(name, result) !== name) throw new Error('Invalid saved categories');
    result.push(name);
  }
  if (!result.includes('Other')) throw new Error('Missing Other category');
  return result;
}

export function deleteCategory(data: TrackerData, name: string): TrackerData {
  if (name === 'Other' || !data.categories.includes(name)) throw new Error('Choose a category other than Other to delete.');
  return {
    ...data,
    categories: data.categories.filter((category) => category !== name),
    expenses: data.expenses.map((expense) => expense.category === name ? { ...expense, category: 'Other' } : expense),
  };
}

export function readBudgets(value: unknown): Budgets {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid saved budgets');
  const entries = Object.entries(value);
  if (!entries.every(([month, amount]) => /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && Number.isSafeInteger(amount) && amount > 0)) throw new Error('Invalid saved budgets');
  return Object.fromEntries(entries);
}

export function readTrackerData(text: string): TrackerData {
  const data = JSON.parse(text);
  if (!data || typeof data !== 'object' || !Array.isArray(data.expenses)) throw new Error('Invalid saved data');
  const savedCategories = data.categories === undefined ? [...categories] : readCategories(data.categories);
  return { expenses: readExpenses(JSON.stringify(data.expenses), savedCategories), budgets: readBudgets(data.budgets), categories: savedCategories };
}

export function budgetSummary(spent: number, budget: number) {
  if (!Number.isSafeInteger(budget) || budget <= 0 || !Number.isSafeInteger(spent) || spent < 0) throw new Error('Invalid budget amounts');
  return { remaining: budget - spent, percent: Math.round(spent / budget * 1000) / 10, progress: Math.min(spent / budget, 1) };
}

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

export function readExpenses(value: string | null, allowedCategories: readonly string[] = categories): Expense[] {
  if (value === null) return [];
  const data: unknown = JSON.parse(value);
  if (!Array.isArray(data) || !data.every((item) =>
    item && typeof item.id === 'string' && item.id.length > 0 && item.id.length <= 128 && typeof item.title === 'string' &&
    item.title.trim().length > 0 && item.title.length <= 80 && Number.isSafeInteger(item.cents) && item.cents > 0 &&
    allowedCategories.includes(item.category) && typeof item.date === 'string' && Number.isFinite(Date.parse(item.date)) && new Date(item.date).toISOString() === item.date
  ) || new Set(data.map((item) => item.id)).size !== data.length) throw new Error('Invalid saved expenses');
  expenseTotal(data);
  return data.map(({ id, title, cents, category, date }) => ({ id, title, cents, category, date }));
}

export const MAX_BACKUP_SIZE = 5 * 1024 * 1024;

export function exportBackup(expenses: Expense[], budgets: Budgets = {}, savedCategories: readonly string[] = categories): string {
  const backup = JSON.stringify({ app: 'finance-tracker', version: 3, currency: 'INR', exportedAt: new Date().toISOString(), expenses, budgets, categories: savedCategories }, null, 2);
  if (new TextEncoder().encode(backup).length > MAX_BACKUP_SIZE) throw new Error('Backups can be up to 5 MB.');
  return backup;
}

export function importBackup(text: string, existing: Expense[], budgets: Budgets = {}, savedCategories: readonly string[] = categories): TrackerData {
  if (text.length > MAX_BACKUP_SIZE) throw new Error('Choose a backup smaller than 5 MB.');
  let backup;
  try { backup = JSON.parse(text); } catch { throw new Error('This file is not valid JSON.'); }
  if (!backup || backup.app !== 'finance-tracker' || ![1, 2, 3].includes(backup.version) || backup.currency !== 'INR' || !Array.isArray(backup.expenses)) {
    throw new Error('Choose a Finance Tracker JSON backup in INR (version 1, 2 or 3).');
  }
  const incomingBudgets = backup.version >= 2 ? readBudgets(backup.budgets) : {};
  const incomingCategories = backup.version === 3 ? readCategories(backup.categories) : [...categories];
  const mergedCategories = [...savedCategories];
  for (const name of incomingCategories) {
    if (!mergedCategories.some((item) => item.toLowerCase() === name.toLowerCase())) mergedCategories.push(name);
  }
  let incoming: Expense[];
  try { incoming = readExpenses(JSON.stringify(backup.expenses), incomingCategories).map((item) => ({ ...item, category: mergedCategories.find((name) => name.toLowerCase() === item.category.toLowerCase())! })); }
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
  return { expenses: result, budgets: { ...incomingBudgets, ...budgets }, categories: mergedCategories };
}

export function expensesForMonth(expenses: Expense[], month: Date): Expense[] {
  return expenses.filter(({ date }) => {
    const day = new Date(date);
    return day.getFullYear() === month.getFullYear() && day.getMonth() === month.getMonth();
  });
}

export function expensesForCategory(expenses: Expense[], category: string | null): Expense[] {
  return category === null ? expenses : expenses.filter((expense) => expense.category === category);
}

export function shiftMonth(month: Date, offset: number): Date {
  return new Date(month.getFullYear(), month.getMonth() + offset, 1);
}

export const money = (cents: number) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(cents / 100);
