import { readLocalResult } from './local-result';

export function hasCompletedVisit() {
  return readLocalResult() !== null;
}
