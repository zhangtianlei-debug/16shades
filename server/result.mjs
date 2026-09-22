import form from '../app/prototype/candidate-form.json' with { type: 'json' };
import { ApiError, requireFields } from './security.mjs';

const axes = ['G', 'M', 'H', 'N'];
const fail = () => {
  throw new ApiError(
    400,
    'INVALID_RESULT',
    '这份结果不完整，请重新完成一次探索。',
  );
};
const exact = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Personal snapshots, not certified test submissions. No answers leave the
// browser. Only this allowlisted summary can be persisted by its owner.
export function normalizeResult(value) {
  requireFields(value, [
    'schema',
    'versions',
    'bankDigest',
    'formId',
    'stage',
    'axes',
    'primary',
    'candidates',
    'flatResponse',
  ]);
  if (
    value.schema !== 'prototype-fixed-form-1' ||
    value.formId !== form.form_id ||
    value.bankDigest !== form.bank_digest ||
    !exact(value.versions, form.versions)
  ) {
    throw new ApiError(
      409,
      'RESULT_VERSION_UNSUPPORTED',
      '页面版本已更新。请先保留当前页面，重新打开网站后再探索。',
    );
  }
  if (
    !['basic', 'full'].includes(value.stage) ||
    typeof value.flatResponse !== 'boolean'
  )
    fail();
  requireFields(value.axes, axes);
  const cleanAxes = {};
  for (const axis of axes) {
    const row = value.axes[axis];
    requireFields(row, [
      'score',
      'percent',
      'direction',
      'boundary',
      'confidence',
      'validCount',
    ]);
    if (
      !Number.isInteger(row.validCount) ||
      row.validCount < 0 ||
      row.validCount > (value.stage === 'basic' ? 4 : 12)
    )
      fail();
    if (row.score === null) {
      if (
        row.percent !== null ||
        row.direction !== null ||
        row.boundary !== null ||
        row.confidence !== 'unavailable'
      )
        fail();
    } else {
      if (
        typeof row.score !== 'number' ||
        !Number.isFinite(row.score) ||
        Math.abs(row.score) > 1 ||
        row.validCount < (value.stage === 'basic' ? 3 : 8)
      )
        fail();
      if (
        row.direction !==
        (row.score === 0 ? null : row.score > 0 ? 'positive' : 'negative')
      )
        fail();
      if (row.boundary !== Math.abs(row.score) < 0.1) fail();
      if (row.percent !== Math.floor(50 + 50 * row.score + 0.5 + 1e-10)) fail();
      if (
        !(
          value.stage === 'basic' ? ['low'] : ['low', 'moderate', 'higher']
        ).includes(row.confidence)
      )
        fail();
    }
    cleanAxes[axis] = { ...row };
  }
  const ids = Array.from(
    { length: 16 },
    (_, i) => `T${String(i + 1).padStart(2, '0')}`,
  );
  const primary = axes.every((axis) => cleanAxes[axis].direction !== null)
    ? ids[
        axes.reduce(
          (n, axis, i) =>
            n +
            (cleanAxes[axis].direction === 'positive' ? [8, 4, 2, 1][i] : 0),
          0,
        )
      ]
    : null;
  const candidates = ids.filter((_, index) =>
    axes.every(
      (axis, i) =>
        cleanAxes[axis].score === null ||
        cleanAxes[axis].boundary ||
        (cleanAxes[axis].direction === 'positive') ===
          !!(index & [8, 4, 2, 1][i]),
    ),
  );
  if (value.primary !== primary || !exact(value.candidates, candidates)) fail();
  return {
    schema: value.schema,
    versions: form.versions,
    bankDigest: form.bank_digest,
    formId: form.form_id,
    stage: value.stage,
    axes: cleanAxes,
    primary,
    candidates,
    flatResponse: value.flatResponse,
  };
}

export function presentation(result) {
  const shares = Array.from({ length: 16 }, (_, i) => {
    const weight = axes.reduce(
      (n, axis, j) =>
        (n *
          (1 +
            (i & [8, 4, 2, 1][j] ? 1 : -1) * (result.axes[axis].score ?? 0))) /
        2,
      1,
    );
    return {
      id: `T${String(i + 1).padStart(2, '0')}`,
      weight,
      percent: Math.round(weight * 10000) / 100,
    };
  }).sort((a, b) =>
    Math.abs(b.weight - a.weight) < 1e-12
      ? a.id.localeCompare(b.id)
      : b.weight - a.weight,
  );
  const tied = shares
    .filter((r) => Math.abs(r.weight - shares[0].weight) < 1e-12)
    .map((r) => r.id);
  const openAxes = axes.filter(
    (axis) => result.axes[axis].score === null || result.axes[axis].boundary,
  );
  return {
    version: 'site-role-match-0.2',
    recommended: shares[0].id,
    shares,
    tied,
    openAxes,
    coverage: axes.reduce((n, axis) => n + result.axes[axis].validCount, 0),
    close:
      tied.length > 1 ||
      openAxes.length > 0 ||
      shares[0].percent - shares[1].percent < 6,
  };
}
