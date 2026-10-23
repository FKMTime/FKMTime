import { AttemptStatus, AttemptType } from '@prisma/client';
import { DNF_VALUE, DNS_VALUE } from 'src/constants';

export interface StatsAttempt {
  status: AttemptStatus;
  type: AttemptType;
  penalty: number | null;
  sessionId: string | null;
  result: { roundId: string } | null;
}

export interface RoundAttemptStats {
  roundId: string;
  solves: number;
  manual: number;
  extras: number;
  dnf: number;
}

/**
 * Per-round counts matching the competition-wide tiles: solves exclude
 * scrambled-only attempts, manual entries have no device session and are
 * not DNS, extras are extra attempts that were used.
 */
export const getRoundAttemptStats = (
  attempts: StatsAttempt[],
): RoundAttemptStats[] => {
  const byRound = new Map<string, RoundAttemptStats>();
  for (const attempt of attempts) {
    const roundId = attempt.result?.roundId;
    if (!roundId || attempt.status === AttemptStatus.SCRAMBLED) continue;
    const stats = byRound.get(roundId) ?? {
      roundId,
      solves: 0,
      manual: 0,
      extras: 0,
      dnf: 0,
    };
    stats.solves++;
    if (attempt.sessionId === null && attempt.penalty !== DNS_VALUE)
      stats.manual++;
    if (
      attempt.type === AttemptType.EXTRA_ATTEMPT &&
      attempt.status === AttemptStatus.STANDARD
    )
      stats.extras++;
    if (attempt.penalty === DNF_VALUE) stats.dnf++;
    byRound.set(roundId, stats);
  }
  return [...byRound.values()];
};
