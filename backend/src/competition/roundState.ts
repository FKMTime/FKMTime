import { DbService } from 'src/db/db.service';

import { Attempt, Prisma, StaffRole } from '../generated/prisma/client';
import { CompetitorRow, GroupChangeResult } from './groupChange';

/**
 * The attempt fields the group progress and group status rules read
 * (groupProgress, groupChange and the result helpers they call). Nothing
 * else is loaded: a round's results are read for every running group,
 * so judges, scramblers and devices would only cost time.
 */
const ATTEMPT_FIELDS = {
  id: true,
  attemptNumber: true,
  type: true,
  status: true,
  replacedBy: true,
  value: true,
  penalty: true,
  solvedAt: true,
  scrambledAt: true,
  extraGrantId: true,
} satisfies Prisma.AttemptSelect;

/** What a round's groups' progress and status are worked out from */
export interface RoundState {
  /** Results not removed under Regulation 9t */
  results: GroupChangeResult[];
  /** Competitors whose result in the round was removed (Regulation 9t) */
  removed: { personId: string; registrantId: number | null }[];
  /** Fresh-set grants not restored yet */
  freshSetGrantIds: string[];
  /** COMPETITOR attendance rows of every group of the round */
  competitorRows: CompetitorRow[];
}

export const roundIdOf = (groupId: string) => groupId.split('-g')[0];

/**
 * Loads the state of every round given in four queries, however many of
 * their groups are running. Every round asked for gets a state, empty when
 * nothing is entered yet.
 */
export const loadRoundStates = async (
  prisma: DbService,
  roundIds: string[],
): Promise<(roundId: string) => RoundState> => {
  const states = new Map<string, RoundState>(
    roundIds.map((roundId) => [
      roundId,
      { results: [], removed: [], freshSetGrantIds: [], competitorRows: [] },
    ]),
  );
  const stateOf = (roundId: string) => {
    const state = states.get(roundId);
    if (!state) throw new Error(`Round ${roundId} was not loaded`);
    return state;
  };
  if (roundIds.length === 0) return stateOf;

  const [results, removed, freshSetGrants, competitorRows] = await Promise.all([
    // Removed results are left out by the database service
    prisma.result.findMany({
      where: { roundId: { in: roundIds } },
      select: {
        roundId: true,
        personId: true,
        person: { select: { registrantId: true } },
        attempts: { select: ATTEMPT_FIELDS },
      },
    }),
    // Asked for by name, as result queries leave removed results out
    prisma.result.findMany({
      where: { roundId: { in: roundIds }, removedAt: { not: null } },
      select: {
        roundId: true,
        personId: true,
        person: { select: { registrantId: true } },
      },
    }),
    prisma.extraGrant.findMany({
      where: {
        useFreshSet: true,
        restoredAt: null,
        result: { roundId: { in: roundIds }, removedAt: null },
      },
      select: { id: true, result: { select: { roundId: true } } },
    }),
    // Every group of the round: a competitor moved on the competitor page
    // shows up here before the stored WCIF knows
    prisma.staffActivity.findMany({
      where: {
        role: StaffRole.COMPETITOR,
        OR: roundIds.map((roundId) => ({
          groupId: { startsWith: `${roundId}-g` },
        })),
      },
      select: {
        personId: true,
        groupId: true,
        isAssigned: true,
        status: true,
        noShow: true,
        person: { select: { registrantId: true } },
      },
    }),
  ]);

  for (const { roundId, personId, person, attempts } of results) {
    stateOf(roundId).results.push({
      personId,
      person,
      // Only the fields above, which is all the rules read
      attempts: attempts as Attempt[],
    });
  }
  for (const { roundId, personId, person } of removed) {
    stateOf(roundId).removed.push({
      personId,
      registrantId: person.registrantId,
    });
  }
  for (const grant of freshSetGrants) {
    stateOf(grant.result.roundId).freshSetGrantIds.push(grant.id);
  }
  for (const row of competitorRows) {
    stateOf(roundIdOf(row.groupId)).competitorRows.push({
      personId: row.personId,
      registrantId: row.person.registrantId,
      groupId: row.groupId,
      isAssigned: row.isAssigned,
      status: row.status,
      noShow: row.noShow,
    });
  }
  return stateOf;
};
