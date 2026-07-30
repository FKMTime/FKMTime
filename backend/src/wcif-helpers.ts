import { Competition, Event, getEventInfoFromWcif, Round } from 'wcif-helpers';

import { roundFormatMap } from './constants';

export const wcifRoleToAttendanceRole = (role: string) => {
  switch (role) {
    case 'staff-judge':
      return 'JUDGE';
    case 'staff-runner':
      return 'RUNNER';
    case 'staff-scrambler':
      return 'SCRAMBLER';
    case 'staff-delegate':
      return 'DELEGATE';
    case 'competitor':
      return 'COMPETITOR';
    default:
      return 'STAFF_OTHER';
  }
};

/**
 * Some WCIF providers (e.g. the dummy WCA used in development) still serve
 * WCIF v1 payloads, where a round cutoff carries `attemptResult` instead of
 * `resultValue`. Normalize such cutoffs in place so the rest of the app can
 * rely on the v2 shape.
 */
export const normalizeWcifCutoffs = (wcif: {
  events?: {
    rounds?: {
      cutoff?: { attemptResult?: number; resultValue?: number } | null;
    }[];
  }[];
}) => {
  wcif?.events?.forEach((event) => {
    event.rounds?.forEach((round) => {
      const cutoff = round.cutoff;
      if (
        cutoff &&
        cutoff.resultValue === undefined &&
        cutoff.attemptResult !== undefined
      ) {
        cutoff.resultValue = cutoff.attemptResult;
      }
    });
  });
};

export const isCumulativeLimit = (roundId: string, wcif: Competition) => {
  const eventId = roundId.split('-')[0];
  const event: Event = getEventInfoFromWcif(eventId, wcif);
  const round: Round = event.rounds.find((r) => r.id === roundId);
  return round.timeLimit.cumulativeRoundIds.length > 0;
};

export const getMaxAttempts = (roundFormat: string) => {
  return roundFormatMap[roundFormat] || 5;
};
