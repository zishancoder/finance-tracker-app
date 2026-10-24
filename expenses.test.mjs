import assert from 'node:assert/strict';
import { parseAmount, readExpenses, expenseTotal, thisMonth } from './expenses.ts';
assert.equal(parseAmount('12.30'), 1230);
assert.equal(parseAmount('0.01'), 1);
for (const value of ['0', '-5', '1.001', '1e3', '', 'Infinity', '1,000', '100000000']) assert.equal(parseAmount(value), null, value);
assert.deepEqual(readExpenses(null), []);
const expenses = readExpenses(JSON.stringify([
  { id: '1', title: 'Lunch', cents: 1230, category: 'Food', date: new Date(2026, 9, 24).toISOString() },
  { id: '2', title: 'Bus', cents: 50, category: 'Transport', date: new Date(2026, 8, 24).toISOString() },
]));
assert.equal(expenseTotal(expenses), 1280);
assert.equal(thisMonth(expenses, new Date(2026, 9, 1)).length, 1);
assert.equal(thisMonth(expenses, new Date(2027, 9, 1)).length, 0);
assert.throws(() => readExpenses('{'));
assert.throws(() => readExpenses('[{"cents":-1}]'));
assert.throws(() => readExpenses(JSON.stringify([expenses[0], expenses[0]])));
assert.throws(() => expenseTotal([{ ...expenses[0], cents: Number.MAX_SAFE_INTEGER }, expenses[1]]));
console.log('Expense validation, arithmetic, and month filtering passed.');
