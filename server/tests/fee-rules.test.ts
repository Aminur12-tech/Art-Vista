import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceFeeProgress } from '../src/services/feeRules.js';

test('an absence does not advance fee progress', () => {
    assert.deepEqual(advanceFeeProgress(2, false), { progress: 2, feeDue: false });
});

test('the fourth attended class creates a fee and resets progress', () => {
    assert.deepEqual(advanceFeeProgress(3, true), { progress: 0, feeDue: true });
});

test('the first three attended classes do not create a fee', () => {
    assert.deepEqual(advanceFeeProgress(0, true), { progress: 1, feeDue: false });
    assert.deepEqual(advanceFeeProgress(1, true), { progress: 2, feeDue: false });
    assert.deepEqual(advanceFeeProgress(2, true), { progress: 3, feeDue: false });
});
