import { axisKeys, type CandidateResult } from './scoring';

// A versioned website presentation layer. The candidate framework's scores,
// primary and candidate set remain untouched. These are geometric weights.
export function recommendRoles(result: CandidateResult) {
  const shares = Array.from({ length: 16 }, (_, index) => {
    const weight = axisKeys.reduce((product, axis, j) => {
      const direction = index & [8, 4, 2, 1][j] ? 1 : -1;
      const score = result.axes[axis].score ?? 0;
      return (product * (1 + direction * score)) / 2;
    }, 1);
    return {
      id: `T${String(index + 1).padStart(2, '0')}`,
      weight,
      percent: Math.round(weight * 10000) / 100,
    };
  }).sort((a, b) =>
    Math.abs(b.weight - a.weight) < 1e-12
      ? a.id.localeCompare(b.id)
      : b.weight - a.weight,
  );
  const tied = shares
    .filter((item) => Math.abs(item.weight - shares[0].weight) < 1e-12)
    .map((item) => item.id);
  const openAxes = axisKeys.filter(
    (axis) => result.axes[axis].score === null || result.axes[axis].boundary,
  );
  const coverage = axisKeys.reduce(
    (sum, axis) => sum + result.axes[axis].validCount,
    0,
  );
  return {
    version: 'site-role-match-0.2',
    recommended: shares[0].id,
    shares,
    tied,
    openAxes,
    coverage,
    close:
      tied.length > 1 ||
      openAxes.length > 0 ||
      shares[0].percent - shares[1].percent < 6,
  };
}
export type Recommendation = ReturnType<typeof recommendRoles>;
export const showPercent = (value: number) => `${Number(value.toFixed(2))}%`;
