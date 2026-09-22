import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const cache = new Map();
function load(name) {
  const path = resolve(name);
  if (cache.has(path)) return cache.get(path);
  if (path.endsWith('.json')) return JSON.parse(readFileSync(path, 'utf8'));
  const exports = {};
  cache.set(path, exports);
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { exports, require: (relative) => load(resolve(dirname(path), /\.(ts|json)$/.test(relative) ? relative : relative + '.ts')) });
  return exports;
}
const { scoreCandidate, exampleResult, candidateForm, axisKeys } = load('app/prototype/scoring.ts');
const { recommendRoles } = load('app/prototype/recommendation.ts');
const { resultSilhouettes } = load('app/prototype/result-presentation.ts');
const { compareWithCharacter, readingState } = load('app/prototype/personal-report-model.ts');
const raw = (stage = 'full', neutral = []) => candidateForm.items.slice(0, stage === 'full' ? 48 : 16).map((item) => neutral.includes(item.axis) ? 3 : item.direction === 1 ? 1 : 5);

for (let index = 0; index < 16; index++) {
  const id = `T${String(index + 1).padStart(2, '0')}`;
  test(`${id}: axes match its own reference, not T01`, () => {
    const result = exampleResult(id);
    const before = JSON.stringify(result);
    const rec = recommendRoles(result);
    assert.equal(rec.recommended, id);
    for (const row of compareWithCharacter(result, id)) {
      assert.equal(row.sameDirection, true);
      assert.equal(row.typicalPositive, result.axes[row.axis].score > 0);
      assert.ok(row.position > 0 && row.position < 100);
    }
    assert.equal(resultSilhouettes(result, rec).length, 0);
    assert.equal(JSON.stringify(result), before, 'presentation must not mutate scores');
  });
}
for (const count of [1, 2, 3, 4]) test(`${2 ** count} equal leaders keep at most two decorative shadows`, () => {
  const result = scoreCandidate(raw('full', axisKeys.slice(0, count)), 'full');
  const rec = recommendRoles(result);
  assert.equal(rec.tied.length, 2 ** count);
  const shadows = resultSilhouettes(result, rec);
  assert.equal(shadows.length, count === 1 ? 1 : 2);
  assert.ok(!shadows.includes(rec.recommended));
  assert.equal(new Set(shadows).size, shadows.length);
});
test('close but unequal results can show silhouettes; a decisive result cannot', () => {
  const answers = raw('full', ['G']);
  const gIndex = candidateForm.items.findIndex((item) => item.axis === 'G');
  answers[gIndex] = candidateForm.items[gIndex].direction === 1 ? 2 : 4;
  const close = scoreCandidate(answers, 'full');
  const rec = recommendRoles(close);
  assert.equal(rec.tied.length, 1);
  assert.equal(rec.close, true);
  assert.equal(resultSilhouettes(close, rec).length, 1);
  const decisive = scoreCandidate(raw(), 'full');
  assert.equal(resultSilhouettes(decisive, recommendRoles(decisive)).length, 0);
});
test('all skipped is unavailable, not a midpoint or a personal match', () => {
  for (const [stage, length] of [['basic', 16], ['full', 48]]) {
    const result = scoreCandidate(Array(length).fill(null), stage);
    assert.equal(resultSilhouettes(result, recommendRoles(result)).length, 0);
    for (const row of compareWithCharacter(result, 'T01')) {
      assert.equal(row.state, 'unavailable');
      assert.equal(row.position, null);
      assert.equal(row.distance, null);
      assert.equal(row.sameDirection, false);
    }
  }
});
test('missing axes stay unknown while real neutral answers stay at the midpoint', () => {
  const answers = raw().map((answer, i) => candidateForm.items[i].axis === 'H' ? null : answer);
  const partial = scoreCandidate(answers, 'full');
  const h = compareWithCharacter(partial, 'T01').find((row) => row.axis === 'H');
  assert.equal(h.position, null);
  assert.equal(readingState(partial, 'H'), 'unavailable');
  const neutral = scoreCandidate(Array(48).fill(3), 'full');
  assert.equal(readingState(neutral, 'H'), 'boundary');
  assert.equal(compareWithCharacter(neutral, 'T01')[2].position, 50);
});
test('16 answers remain intact when 32 further answers form the full report', () => {
  const first = raw('basic', ['H']);
  const full = first.concat(raw().slice(16));
  assert.deepEqual(full.slice(0,16), first);
  assert.equal(scoreCandidate(first,'basic').stage,'basic');
  assert.equal(scoreCandidate(full,'full').stage,'full');
  assert.equal(recommendRoles(scoreCandidate(full,'full')).coverage,48);
});
test('all domain states have complete bilingual copy', () => {
  const copy = load('app/prototype/personal-report-copy.json');
  const english = load('app/i18n/en.json');
  assert.deepEqual(Object.keys(copy), ['intimacy','work','learning','friends','daily']);
  for (const domain of Object.values(copy)) for (const state of ['positive','negative','boundary','unavailable']) for (const field of ['strength','cost','action']) {
    const source = domain[state][field];
    // Short optional guidance is valid; completeness does not require a minimum sentence length.
    assert.ok(typeof source === 'string' && source.trim().length > 0);
    assert.ok(typeof english[source] === 'string' && english[source].trim().length > 0);
    assert.ok(!/\p{Script=Han}/u.test(english[source]));
  }
});
