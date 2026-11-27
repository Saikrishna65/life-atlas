import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveNativeUtility} from '../../src/lib/atlas-ai/native-utilities';

const cases: Array<[string, string | null]> = [
  ['what is 25 plus 17?', "That's 42."],
  ['Calculate (30000 - 14500) * 6.', "That's 93,000."],
  ['Calculate (30000 - 14500) * 6', "That's 93,000."],
  ['2 + 3 * 4', "That's 14."],
  ['(2 + 3) * 4', "That's 20."],
  ['calculate 4 divided by 0', "You can't divide by zero."],
  ['calculate 0.25 + 0.5', "That's 0.75."],
  ['calculate -2 * -3', "That's 6."],
  ['calculate 7 % 4', "That's 3."],
  ['calculate 1 / 3', 'Approximately 0.333333333333.'],
  ['calculate 2 ** 3', 'Check the numbers and operators.'],
  ['calculate 2 + 3) * 6', 'Check the numbers and operators.'],
  ['calculate (2 + 3', 'Check the parentheses.'],
  ['calculate 2 + alert(1)', null],
  ['Add expense 150 + 20 for lunch', null],
  ['2026-11-27', null],
  ['Open trip 2026-11-27', null],
  ['12/3', null],
  ['calculate 12/3', "That's 4."],
  ['remember I spent 5 + 3', null],
  ['It’s Friday at 9 PM. What day and time will it be after 53 hours?', 'Monday at 2:00 AM.'],
  ['Sunday at 11:45 PM. What day and time will it be after 1 hours?', 'Monday at 12:45 AM.'],
  ['Monday at 12 AM. What day and time will it be after 12 hours?', 'Monday at 12:00 PM.'],
  ['Friday at 13 PM. What day and time will it be after 2 hours?', 'Check the starting time.'],
];
for (const [input, expected] of cases) test(input, () => assert.equal(resolveNativeUtility(input)?.text ?? null, expected));
