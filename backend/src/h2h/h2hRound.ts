import { activityCodeToName } from '@wca/helpers';
import {
  Competition,
  getEventInfoFromWcif,
  getRoundInfoFromWcif,
} from 'wcif-helpers';

import { isCumulativeLimit } from '../wcif-helpers';

/** A head-to-head round, run as a bracket of matches (SPEC-001) */
export const isH2hRound = (roundId: string, wcif: Competition): boolean =>
  getRoundInfoFromWcif(roundId, wcif)?.format === 'h';

/** The events Regulation 9b7a allows head-to-head rounds in */
export const H2H_EVENTS = ['333', '444', '333bf', '333oh'];

export const CUMULATIVE_LIMIT_MESSAGE =
  "Head-to-head rounds can't use a cumulative time limit. Change it to a per-attempt limit on the WCA website and sync the competition.";

/**
 * Why this round can't have a bracket, or null when it can: it must be
 * head to head, the last round of an allowed event (9b7), and have a
 * per-attempt time limit
 */
export const whyNoBracket = (
  roundId: string,
  wcif: Competition,
): string | null => {
  const eventId = roundId.split('-r')[0];
  const event = getEventInfoFromWcif(eventId, wcif);
  const round = event?.rounds.find((r) => r.id === roundId);
  if (!event || !round) return 'This round is not in the competition';
  const name = activityCodeToName(roundId);
  if (round.format !== 'h') {
    return `${name} isn't a head-to-head round. Change its format on the WCA website and sync the competition.`;
  }
  if (!H2H_EVENTS.includes(eventId)) {
    return 'Head-to-head rounds are only allowed in 3x3x3, 4x4x4, 3x3x3 Blindfolded and 3x3x3 One-Handed.';
  }
  if (event.rounds[event.rounds.length - 1].id !== roundId) {
    return `Only the last round of an event can be head to head, and ${name} isn't.`;
  }
  if (isCumulativeLimit(roundId, wcif)) return CUMULATIVE_LIMIT_MESSAGE;
  return null;
};
