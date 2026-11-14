import { LiveSyncStatus } from '@prisma/client';

import { LiveAttempt } from './liveAttempts';

/** One round as the WCA lists it (`GET /live/rounds`) */
export interface LiveRoundState {
  roundId: string;
  /** pending, blocked, ready, open or locked, as the WCA says */
  state: string;
  totalCompetitors?: number;
  completedCompetitors?: number;
  competitorCountNeeded?: number;
}

/** Why a result waits for its round to open; not a problem by itself */
export const ROUND_NOT_OPEN = 'Round not open in WCA Integrated Live Results';

/** How long a result may be on its way before Home calls it stuck */
export const STUCK_AFTER_MS = 5 * 60 * 1000;

/** The dot a round gets in the Results page's round strip */
export type LiveRoundDot = 'notOpen' | 'open' | 'done' | 'attention';

/** Results the WCA won't take until someone acts */
export const NEEDS_ATTENTION: LiveSyncStatus[] = [
  LiveSyncStatus.REJECTED,
  LiveSyncStatus.NOT_IN_ROUND,
  LiveSyncStatus.NOT_SENDABLE,
];

/** Results on their way: changed, or sent and not read back yet */
export const ON_THE_WAY: LiveSyncStatus[] = [
  LiveSyncStatus.DIRTY,
  LiveSyncStatus.SENT,
];

export const roundDot = (
  state: string,
  needsAttention: number,
): LiveRoundDot => {
  if (needsAttention > 0) return 'attention';
  if (state === 'open') return 'open';
  if (state === 'locked') return 'done';
  return 'notOpen';
};

const plural = (count: number, word: string) =>
  `${count} ${count === 1 ? word : `${word}s`}`;

/**
 * Why a round can't open yet, in plain words, or null when nothing holds it
 * back. `previousRoundId` is the round its competitors come from.
 */
export const waitingReason = (
  round: LiveRoundState,
  previous: LiveRoundState | undefined,
  previousRoundId: string | null,
): string | null => {
  if (round.state === 'blocked') {
    const needed = round.competitorCountNeeded;
    return needed
      ? `Needs at least ${needed} competitors (regulation 9m)`
      : 'Too few competitors to open (regulation 9m)';
  }
  if (round.state !== 'pending' || !previousRoundId) return null;
  if (previous?.state !== 'open') return `Waiting for ${previousRoundId}`;
  const empty =
    previous.totalCompetitors !== undefined &&
    previous.completedCompetitors !== undefined
      ? previous.totalCompetitors - previous.completedCompetitors
      : 0;
  return empty > 0
    ? `Waiting for ${previousRoundId}: ${plural(empty, 'empty result')}`
    : `Waiting for ${previousRoundId}`;
};

/**
 * The WCA's flags, as the panel says them. `advancing` means sure to advance;
 * `advancing_questionable` means in an advancing place for now.
 */
export const advancingLabel = (
  advancing: boolean | undefined,
  questionable: boolean | undefined,
): 'advances' | 'mayAdvance' | null =>
  advancing ? 'advances' : questionable ? 'mayAdvance' : null;

/** The WCA's attempts as plain values, in attempt order */
export const liveValues = (attempts: LiveAttempt[] | undefined): number[] =>
  [...(attempts ?? [])]
    .sort((a, b) => a.attempt_number - b.attempt_number)
    .map((attempt) => attempt.value);

export const sameValues = (a: number[], b: number[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);
