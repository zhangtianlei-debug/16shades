import { axisKeys, type AxisKey, type CandidateResult } from './scoring';

export type ReadingState = 'positive' | 'negative' | 'boundary' | 'unavailable';

export function readingState(result: CandidateResult, axis: AxisKey): ReadingState {
  const reading = result.axes[axis];
  if (reading.score === null) return 'unavailable';
  if (reading.boundary || reading.score === 0) return 'boundary';
  return reading.score > 0 ? 'positive' : 'negative';
}

// Character endpoints are model references, not an observed population average.
// Keep exact scores for comparisons; rounded percentages are display-only.
export function compareWithCharacter(result: CandidateResult, characterId: string) {
  if (!/^T(0[1-9]|1[0-6])$/.test(characterId)) throw new Error('Unknown character');
  const bits = Number(characterId.slice(1)) - 1;
  return axisKeys.map((axis, index) => {
    const typicalPositive = Boolean(bits & [8, 4, 2, 1][index]);
    const reading = result.axes[axis];
    const state = readingState(result, axis);
    const sameDirection = state !== 'unavailable' && state !== 'boundary' &&
      (state === 'positive') === typicalPositive;
    return {
      axis, state, typicalPositive, sameDirection,
      position: reading.score === null ? null : (reading.score + 1) * 50,
      distance: reading.score === null ? null : (1 - (typicalPositive ? 1 : -1) * reading.score) / 2,
      confidence: reading.confidence,
    };
  });
}
