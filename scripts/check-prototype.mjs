import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { axisKeys, candidateForm, scoreCandidate } from '../app/prototype/scoring.ts';

const referenceRoot = resolve('../14_开放分类标准_v1.0-draft1');
const golden = JSON.parse(readFileSync(resolve(referenceRoot, 'verification/golden_cases.json'), 'utf8'));
const form = JSON.parse(readFileSync(resolve(referenceRoot, 'default_form.json'), 'utf8'));
const bank = JSON.parse(readFileSync(resolve(referenceRoot, 'bank/items.json'), 'utf8'));
assert.equal(candidateForm.form_id, form.form_id);
assert.equal(candidateForm.bank_digest, golden.bank_digest);
assert.deepEqual(candidateForm.items.map((item) => item.id), form.ordered_ids);
for (const item of candidateForm.items) {
  const original = bank.items.find((value) => value.id === item.id);
  for (const key of Object.keys(item)) assert.deepEqual(item[key], original[key], `snapshot ${item.id}.${key}`);
}
for (const test of golden.cases) {
  const items = candidateForm.items.slice(0, test.stage === 'basic' ? 16 : 48);
  const result = scoreCandidate(items.map((item) => test.answers[item.id]), test.stage);
  const expected = test.expected;
  if ('primary' in expected) assert.equal(result.primary, expected.primary, test.id);
  if ('candidate_count' in expected) assert.equal(result.candidates.length, expected.candidate_count, test.id);
  if ('candidate_ids' in expected) assert.deepEqual(result.candidates, expected.candidate_ids, test.id);
  if ('flat_response' in expected) assert.equal(result.flatResponse, expected.flat_response, test.id);
  for (const axis of axisKeys) {
    if (expected.scores) {
      const actual = result.axes[axis].score, target = expected.scores[axis];
      assert.ok(actual === target || actual !== null && target !== null && Math.abs(actual - target) < golden.tolerance, `${test.id}.${axis}.score`);
    }
    if (expected.percent) assert.equal(result.axes[axis].percent, expected.percent[axis], test.id);
    if ('boundary' in expected) assert.equal(result.axes[axis].boundary, expected.boundary, test.id);
    if ('confidence_level' in expected) assert.equal(result.axes[axis].confidence, expected.confidence_level, test.id);
  }
}

const oracleScript = `import json,sys,random
sys.path.insert(0,sys.argv[1]+'/reference')
import shadows
bank=shadows.load(sys.argv[1]+'/bank/items.json'); form=shadows.load(sys.argv[1]+'/default_form.json')
rng=random.Random(16048); out=[]
for n in range(40):
 stage='basic' if n%2 else 'full'; ids=form['ordered_ids'][:16] if stage=='basic' else form['ordered_ids']
 answers={i:rng.choice([None,1,2,3,4,5]) for i in ids}
 out.append({'stage':stage,'answers':answers,'expected':shadows.score(bank,form,answers,stage)})
print(json.dumps(out))`;
const oracle = spawnSync('python3', ['-c', oracleScript, referenceRoot], { encoding: 'utf8' });
assert.equal(oracle.status, 0, oracle.stderr);
for (const test of JSON.parse(oracle.stdout)) {
  const ids = candidateForm.items.slice(0, test.stage === 'basic' ? 16 : 48).map((item) => item.id);
  const actual = scoreCandidate(ids.map((id) => test.answers[id]), test.stage);
  assert.equal(actual.primary, test.expected.type.primary?.id ?? null);
  assert.deepEqual(actual.candidates, test.expected.type.candidates.map((item) => item.id));
  assert.equal(actual.flatResponse, test.expected.flat_response);
  for (const axis of axisKeys) {
    assert.equal(actual.axes[axis].score, test.expected.axes[axis].score);
    assert.equal(actual.axes[axis].percent, test.expected.axes[axis].percent);
    assert.equal(actual.axes[axis].boundary, test.expected.axes[axis].boundary);
    assert.equal(actual.axes[axis].confidence, test.expected.axes[axis].direction_confidence.level);
  }
}
for (const invalid of [[], Array(16), Array(16).fill(undefined), Array(16).fill(true), Array(16).fill('3'), Array(16).fill(3.1), Array(16).fill(0), Array(16).fill(6)]) assert.throws(() => scoreCandidate(invalid, 'basic'));
console.log(`Passed: fixed-form snapshot, ${golden.cases.length} independent golden cases, 40 Python-reference comparisons, 8 invalid inputs.`);
