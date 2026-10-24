import assert from 'node:assert/strict';
import { parseAmount, readExpenses, expenseTotal, expensesForMonth, shiftMonth, exportBackup, importBackup, MAX_BACKUP_SIZE } from './expenses.ts';
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
assert.deepEqual(importBackup(exportBackup(expenses), []), expenses);
assert.deepEqual(importBackup(exportBackup(expenses), expenses), expenses);
assert.deepEqual(importBackup(exportBackup([expenses[1]]), [expenses[0]]), expenses);
assert.deepEqual(importBackup(exportBackup([]), expenses), expenses);
assert.throws(() => importBackup('{', expenses));
assert.throws(() => importBackup('null', expenses));
assert.throws(() => importBackup(' '.repeat(MAX_BACKUP_SIZE + 1), expenses));
for (const change of [{ version: 2 }, { currency: 'USD' }, { expenses: [{ ...expenses[0], cents: -1 }] }, { expenses: [{ ...expenses[0], category: 'Bad' }] }, { expenses: [{ ...expenses[0], date: '2026-02-30T00:00:00.000Z' }] }, { expenses: [{ ...expenses[0], title: 'a'.repeat(81) }] }]) {
  assert.throws(() => importBackup(JSON.stringify({ ...JSON.parse(exportBackup(expenses)), ...change }), expenses));
}
assert.throws(() => importBackup(exportBackup([{ ...expenses[0], cents: 999 }]), expenses));
assert.equal(expenses[0].cents, 1230);
console.log('Backup round-trip, merge, duplicate handling, conflicts, size limits, and invalid-file checks passed.');
