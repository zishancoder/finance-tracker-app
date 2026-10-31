import assert from 'node:assert/strict';
import { categories, categoryName, deleteCategory, readCategories, budgetSummary, readBudgets, readTrackerData, localDate, parseExpenseDate, parseAmount, readExpenses, expenseTotal, expensesForCategory, expensesForMonth, shiftMonth, exportBackup, importBackup, MAX_BACKUP_SIZE } from './expenses.ts';
assert.equal(parseAmount('12.30'), 1230);
assert.equal(parseAmount('0.01'), 1);
for (const value of ['0', '-5', '1.001', '1e3', '', 'Infinity', '1,000', '100000000']) assert.equal(parseAmount(value), null, value);
assert.deepEqual(readExpenses(null), []);
const expenses = readExpenses(JSON.stringify([
  { id: '1', title: 'Lunch', cents: 1230, category: 'Food', date: new Date(2026, 9, 24).toISOString() },
  { id: '2', title: 'Bus', cents: 50, category: 'Transport', date: new Date(2026, 8, 24).toISOString() },
]));
assert.equal(expenseTotal(expenses), 1280);
assert.equal(expensesForMonth(expenses, new Date(2026, 9, 1)).length, 1);
assert.equal(expensesForMonth(expenses, new Date(2027, 9, 1)).length, 0);
assert.equal(expenseTotal(expensesForMonth(expenses, new Date(2026, 8, 1))), 50);
assert.equal(expenseTotal(expensesForMonth(expenses, new Date(2026, 7, 1))), 0);
assert.deepEqual(shiftMonth(new Date(2026, 0, 31), 1), new Date(2026, 1, 1));
assert.deepEqual(shiftMonth(new Date(2026, 0, 1), -1), new Date(2025, 11, 1));
assert.deepEqual(shiftMonth(new Date(2026, 11, 1), 1), new Date(2027, 0, 1));
assert.throws(() => readExpenses('{'));
assert.throws(() => readExpenses('[{"cents":-1}]'));
assert.throws(() => readExpenses(JSON.stringify([expenses[0], expenses[0]])));
assert.throws(() => expenseTotal([{ ...expenses[0], cents: Number.MAX_SAFE_INTEGER }, expenses[1]]));
console.log('Expense validation, arithmetic, and month filtering passed.');
assert.deepEqual(importBackup(exportBackup(expenses), []).expenses, expenses);
assert.deepEqual(importBackup(exportBackup(expenses), expenses).expenses, expenses);
assert.deepEqual(importBackup(exportBackup([expenses[1]]), [expenses[0]]).expenses, expenses);
assert.deepEqual(importBackup(exportBackup([]), expenses).expenses, expenses);
assert.throws(() => importBackup('{', expenses));
assert.throws(() => importBackup('null', expenses));
assert.throws(() => importBackup(' '.repeat(MAX_BACKUP_SIZE + 1), expenses));
for (const change of [{ version: 4 }, { currency: 'USD' }, { expenses: [{ ...expenses[0], cents: -1 }] }, { expenses: [{ ...expenses[0], category: 'Bad' }] }, { expenses: [{ ...expenses[0], date: '2026-02-30T00:00:00.000Z' }] }, { expenses: [{ ...expenses[0], title: 'a'.repeat(81) }] }]) {
  assert.throws(() => importBackup(JSON.stringify({ ...JSON.parse(exportBackup(expenses)), ...change }), expenses));
}
assert.throws(() => importBackup(exportBackup([{ ...expenses[0], cents: 999 }]), expenses));
assert.equal(expenses[0].cents, 1230);
console.log('Backup round-trip, merge, duplicate handling, conflicts, size limits, and invalid-file checks passed.');

assert.equal(parseExpenseDate('2026-02-30'), null);
assert.equal(parseExpenseDate('2026-13-01'), null);
assert.equal(localDate(parseExpenseDate('2024-02-29')), '2024-02-29');
assert.equal(parseExpenseDate('24/10/2026'), null);

assert.deepEqual(budgetSummary(2500, 10000), { remaining: 7500, percent: 25, progress: 0.25 });
assert.deepEqual(budgetSummary(0, 10000), { remaining: 10000, percent: 0, progress: 0 });
assert.deepEqual(budgetSummary(10000, 10000), { remaining: 0, percent: 100, progress: 1 });
assert.deepEqual(budgetSummary(15000, 10000), { remaining: -5000, percent: 150, progress: 1 });
assert.throws(() => budgetSummary(100, 0));
assert.deepEqual(readBudgets({ '2026-10': 10000 }), { '2026-10': 10000 });
for (const value of [null, [], { '2026-13': 100 }, { '2026-10': -1 }, { '2026-10': '100' }, { '2026-10': 1.5 }]) assert.throws(() => readBudgets(value));
const budgets = { '2026-10': 10000, '2026-09': 5000 };
assert.deepEqual(importBackup(exportBackup(expenses, budgets), []), { expenses, budgets, categories: [...categories] });
assert.deepEqual(importBackup(exportBackup([], budgets), [], { '2026-10': 20000 }).budgets, { '2026-10': 20000, '2026-09': 5000 });
assert.deepEqual(importBackup(JSON.stringify({ app: 'finance-tracker', version: 1, currency: 'INR', expenses }), [], budgets), { expenses, budgets, categories: [...categories] });
assert.deepEqual(readTrackerData(JSON.stringify({ expenses, budgets })), { expenses, budgets, categories: [...categories] });
assert.throws(() => readTrackerData(JSON.stringify({ expenses, budgets: { '2026-10': 0 } })));
console.log('Budget calculations, overspending, validation, persistence format, and old/new backups passed.');

const { recentExpensesForSpace } = await import('./recentExpenses.ts');
const recentInput = [expenses[1], expenses[0], { ...expenses[0], id: '3', title: 'Same day' }];
assert.equal(recentExpensesForSpace(recentInput, 107, 1).items.length, 0);
assert.deepEqual(recentExpensesForSpace(recentInput, 108, 1).items.map(x => x.id), ['1']);
assert.deepEqual(recentExpensesForSpace(recentInput, 228, 1).items.map(x => x.id), ['1', '3', '2']);
assert.equal(recentExpensesForSpace(recentInput, 228, 1.5).items.length, 2);
assert.equal(recentExpensesForSpace(recentInput, 228, 0.85).items.length, 3);
assert.equal(recentExpensesForSpace(recentInput, 0, 1).items.length, 0);
assert.equal(recentExpensesForSpace([], 500, 1).items.length, 0);
assert.deepEqual(recentInput.map(x => x.id), ['2', '1', '3']);
console.log('Recent expenses fit complete rows, adapt to text size, sort newest first, and preserve stored order.');

const { themes } = await import('./theme.ts');
const luminance = (hex) => {
  const channels = hex.slice(1).match(/../g).map(x => parseInt(x, 16) / 255).map(x => x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
for (const theme of Object.values(themes)) {
  for (const [foreground, background] of [
    ['text', 'background'], ['muted', 'background'], ['text', 'surface'], ['muted', 'surface'],
    ['placeholder', 'surface'], ['onAccent', 'accent'], ['summaryText', 'summary'], ['summaryMuted', 'summary'],
    ['danger', 'background'], ['danger', 'summary'], ['text', 'activeTab'], ['text', 'selected'],
  ]) assert.ok(contrast(theme[foreground], theme[background]) >= 4.5, `${foreground} on ${background} must remain readable`);
  for (const background of Object.values(theme.categories)) assert.ok(contrast(theme.categoryText, background) >= 4.5);
}
assert.deepEqual(Object.keys(themes.light), Object.keys(themes.dark));
console.log('Light and dark palettes meet text contrast checks across surfaces, buttons, budgets, errors, and categories.');

assert.equal(categoryName('  Health  ', categories), 'Health');
for (const name of ['', '   ', 'food', ' FOOD ', 'a'.repeat(31), 'Bad\nName']) assert.throws(() => categoryName(name, categories));
const customCategories = [...categories, 'Health'];
const customExpense = { ...expenses[0], id: 'health', category: 'Health' };
assert.deepEqual(readTrackerData(JSON.stringify({ expenses: [customExpense], budgets, categories: customCategories })), { expenses: [customExpense], budgets, categories: customCategories });
assert.deepEqual(importBackup(exportBackup([customExpense], budgets, customCategories), []), { expenses: [customExpense], budgets, categories: customCategories });
assert.deepEqual(importBackup(exportBackup([], {}, customCategories), []).categories, customCategories);
assert.deepEqual(importBackup(exportBackup([], {}, [...categories, 'health']), [], {}, customCategories).categories, customCategories);
assert.equal(importBackup(exportBackup([{ ...customExpense, category: 'health' }], {}, [...categories, 'health']), [], {}, customCategories).expenses[0].category, 'Health');
for (const value of [null, [], [...categories, 'food'], [...categories, ''], [...categories, 123], [...categories, ' Health ']]) assert.throws(() => readCategories(value));
assert.throws(() => readTrackerData(JSON.stringify({ expenses: [customExpense], budgets })));
assert.throws(() => importBackup(JSON.stringify({ ...JSON.parse(exportBackup([], {}, customCategories)), categories: [...categories, 'food'] }), []));
assert.deepEqual(importBackup(JSON.stringify({ app: 'finance-tracker', version: 2, currency: 'INR', expenses, budgets }), []).categories, [...categories]);
console.log('Custom categories validate names, persist, round-trip without expenses, merge case-insensitively, and keep older data compatible.');

const beforeDelete = { expenses: [...expenses, customExpense], budgets, categories: customCategories };
const afterDelete = deleteCategory(beforeDelete, 'Health');
assert.deepEqual(afterDelete.categories, [...categories]);
assert.deepEqual(afterDelete.expenses, [...expenses, { ...customExpense, category: 'Other' }]);
assert.equal(expenseTotal(afterDelete.expenses), expenseTotal(beforeDelete.expenses));
assert.deepEqual(afterDelete.budgets, budgets);
assert.equal(beforeDelete.expenses[2].category, 'Health');
assert.deepEqual(readTrackerData(JSON.stringify(afterDelete)), afterDelete);
const withoutFood = deleteCategory(afterDelete, 'Food');
assert.ok(!withoutFood.categories.includes('Food'));
assert.equal(withoutFood.expenses[0].category, 'Other');
assert.deepEqual(readTrackerData(JSON.stringify(withoutFood)), withoutFood);
assert.deepEqual(importBackup(exportBackup(withoutFood.expenses, budgets, withoutFood.categories), [], {}, withoutFood.categories), { ...withoutFood, expenses: [...withoutFood.expenses].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)) });
assert.deepEqual(deleteCategory({ expenses: [], budgets, categories: customCategories }, 'Health').expenses, []);
assert.throws(() => deleteCategory(beforeDelete, 'Other'));
assert.throws(() => deleteCategory(beforeDelete, 'Missing'));
assert.deepEqual(readCategories(['Other']), ['Other']);
assert.throws(() => readCategories(['Food']));
console.log('Category deletion preserves expenses and totals, protects Other, and survives persistence and backup round-trips.');

const categoryInput = [...expenses, customExpense, { ...customExpense, id: 'health-old', cents: 500, date: expenses[1].date }];
assert.equal(expenseTotal(expensesForCategory(categoryInput, 'Health')), 1730);
assert.equal(expenseTotal(expensesForCategory(expensesForMonth(categoryInput, new Date(2026, 9, 1)), 'Health')), 1230);
assert.equal(expenseTotal(expensesForCategory(expensesForMonth(categoryInput, new Date(2026, 8, 1)), 'Health')), 500);
assert.deepEqual(expensesForCategory(categoryInput, null), categoryInput);
assert.deepEqual(expensesForCategory(categoryInput, 'Bills'), []);
assert.equal(expenseTotal(expensesForCategory(categoryInput, 'Bills')), 0);
assert.deepEqual(expensesForCategory([], 'Health'), []);
assert.deepEqual(expensesForCategory(categoryInput, 'Food'), [expenses[0]]);
assert.equal(categoryInput.length, 4);
console.log('Category filters handle custom categories, monthly/all-time totals, empty matches, clearing, and preserve input.');
