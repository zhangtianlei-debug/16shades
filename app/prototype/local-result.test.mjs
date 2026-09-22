import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreCandidate } from './scoring.ts';
import {
  writeLocalResult,
  readLocalResult,
  clearLocalResult,
  setLocalResultEnabled,
  localResultKey,
  localResultLifetime,
} from './local-result.ts';

const now = Date.UTC(2026, 8, 8);
function storage() {
  const map = new Map();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value),
    removeItem: (key) => map.delete(key),
  };
}
const basic = () => scoreCandidate(Array(16).fill(3), 'basic');

test('a guest result survives another read, but expires at exactly 72 hours without renewal', () => {
  const store = storage();
  const first = writeLocalResult(basic(), store, now);
  assert.equal(first.expiresAt, now + 72 * 60 * 60 * 1000);
  assert.deepEqual(
    readLocalResult(store, now + localResultLifetime - 1),
    first,
  );
  assert.equal(JSON.parse(store.getItem(localResultKey)).completedAt, now);
  assert.equal(readLocalResult(store, now + localResultLifetime), null);
  assert.equal(store.getItem(localResultKey), null);
});
test('a completed full test replaces the basic result and starts its own three days', () => {
  const store = storage();
  writeLocalResult(basic(), store, now);
  const full = scoreCandidate(Array(48).fill(4), 'full');
  writeLocalResult(full, store, now + 1000);
  assert.deepEqual(
    readLocalResult(store, now + localResultLifetime).result,
    full,
  );
  assert.equal(readLocalResult(store, now + localResultLifetime + 1000), null);
});
test('only the result allowlist is saved; raw answers and account fields are excluded', () => {
  const store = storage();
  writeLocalResult(
    { ...basic(), answers: [1, 2, 3], username: 'private' },
    store,
    now,
  );
  const value = store.getItem(localResultKey);
  assert.ok(!value.includes('answers') && !value.includes('username'));
  assert.deepEqual(readLocalResult(store, now).result, basic());
});
test('all skipped answers do not overwrite a real result', () => {
  const store = storage();
  writeLocalResult(basic(), store, now);
  assert.equal(
    writeLocalResult(
      scoreCandidate(Array(16).fill(null), 'basic'),
      store,
      now + 1,
    ),
    null,
  );
  assert.equal(readLocalResult(store, now + 1).completedAt, now);
});
test('clear and opt out do not change account cookies or other site storage', () => {
  const store = storage();
  store.setItem('unrelated-account-setting', 'keep');
  writeLocalResult(basic(), store, now);
  assert.equal(clearLocalResult(store), true);
  assert.equal(store.getItem('unrelated-account-setting'), 'keep');
  writeLocalResult(basic(), store, now);
  assert.equal(setLocalResultEnabled(false, store), true);
  assert.equal(readLocalResult(store, now), null);
  assert.equal(writeLocalResult(basic(), store, now), null);
  setLocalResultEnabled(true, store);
  assert.equal(readLocalResult(store, now), null);
  assert.ok(writeLocalResult(basic(), store, now + 1));
});
test('malformed, incompatible, and tampered expiry records are removed safely', () => {
  const store = storage();
  for (const raw of ['{broken', 'null', '[]']) {
    store.setItem(localResultKey, raw);
    assert.equal(readLocalResult(store, now), null);
    assert.equal(store.getItem(localResultKey), null);
  }
  for (const change of [
    (v) => {
      v.result.bankDigest = 'old';
    },
    (v) => {
      v.result.axes.G.score = 'x';
    },
    (v) => {
      v.expiresAt += 1;
    },
    (v) => {
      v.completedAt = now + 100;
    },
  ]) {
    const value = writeLocalResult(basic(), store, now);
    change(value);
    store.setItem(localResultKey, JSON.stringify(value));
    assert.equal(readLocalResult(store, now), null);
  }
});
test('denied storage and quota failures do not break the current result', () => {
  const denied = {
    getItem() {
      throw Error('blocked');
    },
    setItem() {
      throw Error('quota');
    },
    removeItem() {
      throw Error('blocked');
    },
  };
  assert.equal(readLocalResult(denied, now), null);
  assert.equal(writeLocalResult(basic(), denied, now), null);
  assert.equal(clearLocalResult(denied), false);
  assert.equal(setLocalResultEnabled(false, denied), false);
});
