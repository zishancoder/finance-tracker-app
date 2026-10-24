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
    item && typeof item.id === 'string' && typeof item.title === 'string' &&
    item.title.trim().length > 0 && Number.isSafeInteger(item.cents) && item.cents > 0 &&
    categories.includes(item.category) && typeof item.date === 'string' && Number.isFinite(Date.parse(item.date))
  ) || new Set(data.map((item) => item.id)).size !== data.length) throw new Error('Invalid saved expenses');
  expenseTotal(data);
  return data;
}

export function thisMonth(expenses: Expense[], now = new Date()): Expense[] {
  return expenses.filter(({ date }) => {
    const day = new Date(date);
    return day.getFullYear() === now.getFullYear() && day.getMonth() === now.getMonth();
  });
}

export const money = (cents: number) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(cents / 100);
