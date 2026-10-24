import type { Expense } from './expenses';

export function recentExpensesForSpace(expenses: Expense[], height: number, fontScale: number) {
  const headerHeight = Math.ceil(24 * fontScale) + 24;
  const rowHeight = Math.max(56, Math.ceil(40 * fontScale) + 20);
  const count = Math.max(0, Math.floor((height - headerHeight) / rowHeight));
  const items = count ? [...expenses].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, count) : [];
  return { headerHeight, rowHeight, items };
}
