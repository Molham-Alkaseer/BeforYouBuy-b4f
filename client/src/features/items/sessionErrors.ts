import type { ApiErrorBody } from './itemTypes';

export type SessionProblemKind = 'unauthorized' | 'forbidden';

// 401 = not signed in, or the session ended. 403 = signed in but not allowed.
// Every other failure keeps its own message and is not a login problem.
export function sessionProblemOf(
  error: ApiErrorBody,
): SessionProblemKind | null {
  if (error.statusCode === 401) {
    return 'unauthorized';
  }
  if (error.statusCode === 403) {
    return 'forbidden';
  }
  return null;
}