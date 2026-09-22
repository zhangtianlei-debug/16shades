import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import {
  axisKeys,
  candidateForm,
  scoreCandidate,
} from '../app/prototype/scoring.ts';

// Resolve the app's extensionless TypeScript import when running in Node.
registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(
      specifier === './scoring' &&
        context.parentURL?.endsWith('/recommendation.ts')
        ? './scoring.ts'
        : specifier,
      context,
    );
  },
});
const { recommendRoles } = await import('../app/prototype/recommendation.ts');
const ids = Array.from(
  { length: 16 },
  (_, i) => `T${String(i + 1).padStart(2, '0')}`,
);
for (const stage of ['basic', 'full']) {
  const count = stage === 'basic' ? 16 : 48;
  for (const answer of [3, null]) {
    const result = scoreCandidate(Array(count).fill(answer), stage);
    const before = structuredClone(result);
    const match = recommendRoles(result);
    assert.equal(match.recommended, 'T01');
    assert.deepEqual(match.tied, ids);
    assert.ok(match.shares.every((item) => item.percent === 6.25));
    assert.equal(match.coverage, answer === null ? 0 : count);
    assert.equal(result.primary, null);
    assert.ok(
      axisKeys.every(
        (axis) => result.axes[axis].percent === (answer === null ? null : 50),
      ),
    );
    assert.deepEqual(
      result,
      before,
      'Presentation must not mutate the candidate framework result',
    );
  }
  for (let index = 0; index < 16; index++) {
    const answers = candidateForm.items.slice(0, count).map((item) => {
      const sign = index & [8, 4, 2, 1][axisKeys.indexOf(item.axis)] ? 1 : -1;
      return 3 + 2 * sign * item.direction;
    });
    const match = recommendRoles(scoreCandidate(answers, stage));
    assert.equal(match.recommended, ids[index]);
    assert.equal(match.shares[0].percent, 100);
    assert.ok(match.shares.slice(1).every((item) => item.percent === 0));
    const neutralLastAxis = candidateForm.items
      .slice(0, count)
      .map((item, i) => (item.axis === 'N' ? 3 : answers[i]));
    const pair = recommendRoles(scoreCandidate(neutralLastAxis, stage));
    assert.deepEqual(pair.tied, [ids[index & ~1], ids[(index & ~1) + 1]]);
    assert.ok(pair.shares.slice(0, 2).every((item) => item.percent === 50));
  }
}
let seed = 16048;
for (let i = 0; i < 400; i++) {
  const stage = i % 2 ? 'basic' : 'full';
  const count = stage === 'basic' ? 16 : 48;
  const answers = Array.from({ length: count }, () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return [null, 1, 2, 3, 4, 5][seed % 6];
  });
  const result = scoreCandidate(answers, stage);
  const before = structuredClone(result);
  const match = recommendRoles(result);
  assert.ok(
    Math.abs(match.shares.reduce((sum, row) => sum + row.weight, 0) - 1) <
      1e-12,
  );
  assert.equal(new Set(match.shares.map((row) => row.id)).size, 16);
  assert.ok(
    match.shares.every(
      (row) =>
        Number.isFinite(row.percent) && row.percent >= 0 && row.percent <= 100,
    ),
  );
  assert.ok(
    match.shares.every(
      (row, j) => !j || row.weight <= match.shares[j - 1].weight + 1e-12,
    ),
  );
  if (result.primary) assert.equal(match.recommended, result.primary);
  assert.deepEqual(result, before);
  assert.deepEqual(
    recommendRoles(result),
    match,
    'Stable ordering on repeated evaluation',
  );
}
console.log(
  'Passed: 4 neutral/missing stages, 32 endpoints, 32 two-way ties, 400 deterministic mixed-answer cases; normalization and framework immutability verified.',
);
