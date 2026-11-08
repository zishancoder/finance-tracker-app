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
export type Expense = { id: string; title: string; cents: number; category: Category; date: string; wallet?: boolean };
export type Budgets = Record<string, number>;
export type WalletDeposit = { id: string; title: string; cents: number; date: string };
export type TrackerData = { expenses: Expense[]; budgets: Budgets; categories: string[]; carryForwardMonths?: string[]; walletDeposits?: WalletDeposit[] };

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
  const result: TrackerData = { expenses: readExpenses(JSON.stringify(data.expenses), savedCategories), budgets: readBudgets(data.budgets), categories: savedCategories };
  const carryForwardMonths = readCarryForwardMonths(data.carryForwardMonths, result.budgets);
  if (carryForwardMonths.length) result.carryForwardMonths = carryForwardMonths;
  const deposits = readWalletDeposits(data.walletDeposits);
  if (deposits.length) result.walletDeposits = deposits;
  walletSummary(result.expenses, deposits);
  monthlyBudget(result.expenses, result.budgets, carryForwardMonths, '9999-12');
  return result;
}

function readCarryForwardMonths(value: unknown, budgets: Budgets): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every((month) => typeof month === 'string' && Object.hasOwn(budgets, month)) || new Set(value).size !== value.length) throw new Error('Invalid budget carry-forward settings');
  return value;
}

export function monthlyBudget(expenses: Expense[], budgets: Budgets, carryForwardMonths: readonly string[], month: string) {
  const spending: Record<string, number> = {};
  for (const expense of expenses) {
    const key = localDate(new Date(expense.date)).slice(0, 7);
    spending[key] = (spending[key] ?? 0) + expense.cents;
  }
  const enabled = new Set(carryForwardMonths);
  let previous = '';
  let remaining = 0;
  let carried = 0;
  let total = 0;
  for (const key of [...new Set([...Object.keys(budgets), month])].filter((key) => key <= month).sort()) {
    const [year, number] = key.split('-').map(Number);
    const precedingMonth = number === 1 ? `${String(year - 1).padStart(4, '0')}-12` : `${key.slice(0, 4)}-${String(number - 1).padStart(2, '0')}`;
    carried = previous === precedingMonth && enabled.has(previous) ? Math.max(remaining, 0) : 0;
    total = (budgets[key] ?? 0) + carried;
    if (!Number.isSafeInteger(total)) throw new Error('Budget total is too large');
    remaining = total - (spending[key] ?? 0);
    previous = key;
  }
  return { carried, total };
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
    (item.wallet === undefined || typeof item.wallet === 'boolean') && allowedCategories.includes(item.category) && typeof item.date === 'string' && Number.isFinite(Date.parse(item.date)) && new Date(item.date).toISOString() === item.date
  ) || new Set(data.map((item) => item.id)).size !== data.length) throw new Error('Invalid saved expenses');
  expenseTotal(data);
  return data.map(({ id, title, cents, category, date, wallet }) => ({ id, title, cents, category, date, ...(wallet ? { wallet: true } : {}) }));
}

export function readWalletDeposits(value: unknown): WalletDeposit[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error('Invalid wallet deposits');
  return readExpenses(JSON.stringify(value.map((item) => ({ ...item, category: 'Other' }))))
    .map(({ id, title, cents, date }) => ({ id, title, cents, date }));
}

export function walletSummary(expenses: Expense[], deposits: WalletDeposit[]) {
  const added = deposits.reduce((sum, item) => sum + item.cents, 0);
  if (!Number.isSafeInteger(added) || added < 0) throw new Error('Wallet total is too large');
  const spent = expenseTotal(expenses.filter((item) => item.wallet));
  return { added, spent, balance: added - spent };
}

export const MAX_BACKUP_SIZE = 5 * 1024 * 1024;

export function exportBackup(expenses: Expense[], budgets: Budgets = {}, savedCategories: readonly string[] = categories, carryForwardMonths: readonly string[] = [], walletDeposits: WalletDeposit[] = []): string {
  const backup = JSON.stringify({ app: 'finance-tracker', version: 5, currency: 'INR', exportedAt: new Date().toISOString(), expenses, budgets, categories: savedCategories, carryForwardMonths, walletDeposits }, null, 2);
  if (new TextEncoder().encode(backup).length > MAX_BACKUP_SIZE) throw new Error('Backups can be up to 5 MB.');
  return backup;
}

export function importBackup(text: string, existing: Expense[], budgets: Budgets = {}, savedCategories: readonly string[] = categories, carryForwardMonths: readonly string[] = [], walletDeposits: WalletDeposit[] = []): TrackerData {
  if (text.length > MAX_BACKUP_SIZE) throw new Error('Choose a backup smaller than 5 MB.');
  let backup;
  try { backup = JSON.parse(text); } catch { throw new Error('This file is not valid JSON.'); }
  if (!backup || backup.app !== 'finance-tracker' || ![1, 2, 3, 4, 5].includes(backup.version) || backup.currency !== 'INR' || !Array.isArray(backup.expenses)) {
    throw new Error('Choose a Finance Tracker JSON backup in INR (version 1, 2, 3, 4 or 5).');
  }
  const incomingDeposits = backup.version >= 5 ? readWalletDeposits(backup.walletDeposits) : [];
  const mergedDeposits = new Map(walletDeposits.map((item) => [item.id, item]));
  for (const item of incomingDeposits) {
    const previous = mergedDeposits.get(item.id);
    if (previous && (['title', 'cents', 'date'] as const).some((key) => previous[key] !== item[key])) throw new Error('A wallet deposit conflicts with an existing entry. Nothing was imported.');
    mergedDeposits.set(item.id, item);
  }
  const deposits = [...mergedDeposits.values()];
  const incomingBudgets = backup.version >= 2 ? readBudgets(backup.budgets) : {};
  const incomingCategories = backup.version >= 3 ? readCategories(backup.categories) : [...categories];
  const incomingCarry = backup.version >= 4 ? readCarryForwardMonths(backup.carryForwardMonths, incomingBudgets) : [];
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
    if (previous && (['title', 'cents', 'category', 'date', 'wallet'] as const).some((key) => previous[key] !== item[key])) {
      throw new Error('A backup expense conflicts with an existing expense. Nothing was imported.');
    }
    merged.set(item.id, item);
  }
  const result = [...merged.values()].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  expenseTotal(result);
  walletSummary(result, deposits);
  const mergedBudgets = { ...incomingBudgets, ...budgets };
  const mergedCarry = [...carryForwardMonths, ...incomingCarry.filter((month) => !Object.hasOwn(budgets, month))];
  monthlyBudget(result, mergedBudgets, mergedCarry, '9999-12');
  return { expenses: result, budgets: mergedBudgets, categories: mergedCategories, ...(mergedCarry.length ? { carryForwardMonths: mergedCarry } : {}), ...(deposits.length ? { walletDeposits: deposits } : {}) };
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
