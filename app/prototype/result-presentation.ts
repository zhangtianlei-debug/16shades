import type { CandidateResult } from './scoring';
import type { Recommendation } from './recommendation';

// Decorative possibilities, never a visible second/third-place ranking.
// Missing information must not create a personal result from midpoint defaults.
export function resultSilhouettes(result: CandidateResult, recommendation: Recommendation): string[] {
  if (!recommendation.coverage || !recommendation.close ||
      !Object.values(result.axes).some((axis) => axis.score !== null)) return [];
  const candidates = recommendation.tied.length > 1
    ? recommendation.tied
    : recommendation.shares.filter((item) => item.weight > 0).map((item) => item.id);
  return candidates.filter((id) => id !== recommendation.recommended).slice(0, 2);
}
