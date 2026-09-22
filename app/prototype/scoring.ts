import form from './candidate-form.json' with { type: 'json' };

export const candidateForm = form;
export const axisKeys = ['G', 'M', 'H', 'N'] as const;
export type AxisKey = (typeof axisKeys)[number];
export type Stage = 'basic' | 'full';
export type Answer = number | null;
type Item = (typeof form.items)[number];

function fraction(rows: { item: Item; answer: number }[]) {
  const positive = rows.filter(({ item }) => item.direction === 1);
  const negative = rows.filter(({ item }) => item.direction === -1);
  if (!positive.length || !negative.length) return null;
  const p = positive.reduce((sum, row) => sum + row.answer - 3, 0);
  const n = negative.reduce((sum, row) => sum + row.answer - 3, 0);
  return { numerator: p * negative.length - n * positive.length, denominator: 4 * positive.length * negative.length };
}

// This prototype supports the exact fixed, equal-weight candidate form only.
// Integer ratios keep the zero, 0.10 boundary and half-up decisions exact.
export function scoreCandidate(answers: Answer[], stage: Stage) {
  if (stage !== 'basic' && stage !== 'full') throw new Error('未知测试阶段');
  const length = stage === 'basic' ? 16 : 48;
  if (answers.length !== length || Array.from(answers).some((value) => value !== null && (!Number.isInteger(value) || value < 1 || value > 5))) throw new Error('答案须为完整阶段的1—5整数或明确跳过');
  if (form.items.length !== 48 || form.items.some((item) => item.primary_weight !== 1 || !axisKeys.includes(item.axis as AxisKey))) throw new Error('不支持当前题库配置');
  const axes = Object.fromEntries(axisKeys.map((axis) => {
    const rows = form.items.slice(0, length).map((item, index) => ({ item, answer: answers[index] })).filter((row) => row.item.axis === axis);
    const valid = rows.filter((row): row is { item: Item; answer: number } => row.answer !== null);
    const positive = valid.filter(({ item }) => item.direction === 1);
    const negative = valid.filter(({ item }) => item.direction === -1);
    const facets = new Set(valid.map(({ item }) => item.facet));
    const contexts = new Set(valid.flatMap(({ item }) => item.contexts));
    const families = new Set(valid.map(({ item }) => item.family));
    const raw = fraction(valid);
    const threshold = stage === 'basic' ? [3, 1, 2] : [8, 3, 3];
    const usable = !!raw && valid.length >= threshold[0] && positive.length >= threshold[1] && negative.length >= threshold[1] && facets.size >= threshold[2];
    const designated = rows.filter(({ item }) => item.consistency_pair);
    const incomplete = designated.length !== 2 || designated.some(({ answer }) => answer === null);
    const tension = !incomplete && Math.abs(designated[0].item.direction * (designated[0].answer! - 3) - designated[1].item.direction * (designated[1].answer! - 3)) >= 3;
    const resamples = [...families].map((family) => fraction(valid.filter(({ item }) => item.family !== family))).filter((value) => value !== null);
    const stability = !raw || raw.numerator === 0 || !resamples.length ? null : resamples.filter((value) => value.numerator !== 0 && (value.numerator > 0) === (raw.numerator > 0)).length / resamples.length;
    let confidence = 'low';
    if (!usable) confidence = 'unavailable';
    else if (stage === 'full' && raw && Math.abs(raw.numerator) * 4 >= raw.denominator && valid.length >= 10 && positive.length >= 4 && negative.length >= 4 && facets.size === 3 && contexts.size >= 5 && families.size >= 8 && stability !== null && stability >= .9 && !incomplete && !tension) confidence = 'higher';
    else if (stage === 'full' && raw && Math.abs(raw.numerator) * 10 >= raw.denominator && stability !== null && stability >= .75 && contexts.size >= 4 && !tension) confidence = 'moderate';
    return [axis, {
      score: usable && raw ? raw.numerator / raw.denominator : null,
      percent: usable && raw ? Math.floor((100 * raw.denominator + 100 * raw.numerator + raw.denominator) / (2 * raw.denominator)) : null,
      direction: !usable || !raw || raw.numerator === 0 ? null : raw.numerator > 0 ? 'positive' : 'negative',
      boundary: usable && raw ? Math.abs(raw.numerator) * 10 < raw.denominator : null,
      confidence,
      validCount: valid.length,
    }];
  })) as Record<AxisKey, { score: number | null; percent: number | null; direction: string | null; boundary: boolean | null; confidence: string; validCount: number }>;
  const ids = Array.from({ length: 16 }, (_, index) => `T${String(index + 1).padStart(2, '0')}`);
  const candidates = ids.filter((_, index) => axisKeys.every((axis, j) => axes[axis].score === null || axes[axis].boundary || (axes[axis].direction === 'positive') === !!(index & [8, 4, 2, 1][j])));
  const primary = axisKeys.every((axis) => axes[axis].direction !== null) ? ids[axisKeys.reduce((sum, axis, index) => sum + (axes[axis].direction === 'positive' ? [8, 4, 2, 1][index] : 0), 0)] : null;
  const validAnswers = answers.filter((answer) => answer !== null);
  return { schema: 'prototype-fixed-form-1', versions: form.versions, bankDigest: form.bank_digest, formId: form.form_id, stage, axes, primary, candidates, flatResponse: validAnswers.length > 1 && new Set(validAnswers).size === 1 };
}

export type CandidateResult = ReturnType<typeof scoreCandidate>;

export function exampleResult(type: string) {
  const number = Math.max(0, Math.min(15, Number(type.slice(1)) - 1));
  const answers = form.items.map((item, index) => {
    const positive = !!(number & [8, 4, 2, 1][axisKeys.indexOf(item.axis as AxisKey)]);
    const aligned = positive === (item.direction === 1);
    return aligned ? (index % 3 ? 4 : 5) : (index % 3 ? 2 : 1);
  });
  return scoreCandidate(answers, 'full');
}
