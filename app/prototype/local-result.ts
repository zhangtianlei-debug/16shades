import form from './candidate-form.json' with { type: 'json' };
import type { CandidateResult } from './scoring';

export const localResultKey = 'shadow16-local-result-v1';
export const localResultPreferenceKey = 'shadow16-local-result-preference';
export const localResultChanged = 'shadow16-local-result-change';
export const localResultLifetime = 3 * 24 * 60 * 60 * 1000;
const legacyVisitKey = 'shadow16-completed-visit-v1';
type LocalStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type LocalResult = {
  result: CandidateResult;
  completedAt: number;
  expiresAt: number;
};
const axes = ['G', 'M', 'H', 'N'] as const;
const roleId = (value: unknown) =>
  typeof value === 'string' && /^T(?:0[1-9]|1[0-6])$/.test(value);

function browserStore(): LocalStore | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

// Browser data is untrusted. Keep only the result allowlist; never persist
// answer arrays, account identity, arbitrary fields, or an unsupported version.
function cleanResult(value: unknown): CandidateResult | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as CandidateResult;
  if (
    v.schema !== 'prototype-fixed-form-1' ||
    v.formId !== form.form_id ||
    v.bankDigest !== form.bank_digest ||
    JSON.stringify(v.versions) !== JSON.stringify(form.versions) ||
    !['basic', 'full'].includes(v.stage) ||
    typeof v.flatResponse !== 'boolean' ||
    !v.axes ||
    (v.primary !== null && !roleId(v.primary)) ||
    !Array.isArray(v.candidates) ||
    v.candidates.length > 16 ||
    !v.candidates.every(roleId)
  )
    return null;
  const cleanAxes = {} as CandidateResult['axes'];
  for (const axis of axes) {
    const row = v.axes[axis];
    if (
      !row ||
      !Number.isInteger(row.validCount) ||
      row.validCount < 0 ||
      row.validCount > (v.stage === 'basic' ? 4 : 12) ||
      !(
        row.score === null ||
        (Number.isFinite(row.score) && Math.abs(row.score) <= 1)
      ) ||
      !(
        row.percent === null ||
        (Number.isInteger(row.percent) &&
          row.percent >= 0 &&
          row.percent <= 100)
      ) ||
      ![null, 'positive', 'negative'].includes(row.direction) ||
      !(row.boundary === null || typeof row.boundary === 'boolean') ||
      !['low', 'moderate', 'higher', 'unavailable'].includes(row.confidence)
    )
      return null;
    cleanAxes[axis] = {
      score: row.score,
      percent: row.percent,
      direction: row.direction,
      boundary: row.boundary,
      confidence: row.confidence,
      validCount: row.validCount,
    };
  }
  if (!axes.some((axis) => cleanAxes[axis].validCount > 0)) return null;
  return {
    schema: v.schema,
    versions: form.versions,
    bankDigest: v.bankDigest,
    formId: v.formId,
    stage: v.stage,
    axes: cleanAxes,
    primary: v.primary,
    candidates: [...v.candidates],
    flatResponse: v.flatResponse,
  };
}

function announce() {
  if (typeof window !== 'undefined')
    window.dispatchEvent(new Event(localResultChanged));
}

export function localResultEnabled(storage = browserStore()) {
  try {
    return !!storage && storage.getItem(localResultPreferenceKey) !== 'off';
  } catch {
    return false;
  }
}

export function readLocalResult(
  storage = browserStore(),
  now = Date.now(),
): LocalResult | null {
  try {
    storage?.removeItem(legacyVisitKey);
    const raw = storage?.getItem(localResultKey);
    if (!raw) return null;
    const value = JSON.parse(raw);
    const result = cleanResult(value?.result);
    if (
      !localResultEnabled(storage) ||
      !result ||
      !Number.isSafeInteger(value.completedAt) ||
      value.completedAt > now ||
      now >= value.completedAt + localResultLifetime ||
      value.expiresAt !== value.completedAt + localResultLifetime
    ) {
      storage?.removeItem(localResultKey);
      return null;
    }
    return {
      result,
      completedAt: value.completedAt,
      expiresAt: value.expiresAt,
    };
  } catch {
    try {
      storage?.removeItem(localResultKey);
    } catch {
      /* Storage may be blocked. */
    }
    return null;
  }
}

export function writeLocalResult(
  result: CandidateResult,
  storage = browserStore(),
  now = Date.now(),
): LocalResult | null {
  const clean = cleanResult(result);
  if (!clean || !localResultEnabled(storage)) return null;
  const snapshot = {
    result: clean,
    completedAt: now,
    expiresAt: now + localResultLifetime,
  };
  try {
    storage!.setItem(localResultKey, JSON.stringify(snapshot));
    storage!.removeItem(legacyVisitKey);
    announce();
    return snapshot;
  } catch {
    return null;
  }
}

export function clearLocalResult(storage = browserStore()) {
  try {
    storage?.removeItem(localResultKey);
    storage?.removeItem(legacyVisitKey);
    announce();
    return !!storage;
  } catch {
    return false;
  }
}

export function setLocalResultEnabled(
  enabled: boolean,
  storage = browserStore(),
) {
  try {
    if (!storage) return false;
    storage.setItem(localResultPreferenceKey, enabled ? 'on' : 'off');
    if (!enabled) return clearLocalResult(storage);
    announce();
    return true;
  } catch {
    return false;
  }
}
