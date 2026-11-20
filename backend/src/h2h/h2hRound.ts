import { Competition, getRoundInfoFromWcif } from 'wcif-helpers';

/** A head-to-head round, run as a bracket of matches (SPEC-001) */
export const isH2hRound = (roundId: string, wcif: Competition): boolean =>
  getRoundInfoFromWcif(roundId, wcif)?.format === 'h';
