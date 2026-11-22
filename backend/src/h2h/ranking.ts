import { H2hMatchStatus, H2hSide, H2hStage } from '../generated/prisma/client';

export interface RankingMatch {
  matchNumber: number;
  stage: H2hStage;
  status: H2hMatchStatus;
  entrantAId: string | null;
  entrantBId: string | null;
  winnerSide: H2hSide | null;
}

export interface RankingEntrant {
  id: string;
  /**
   * WCA-encoded best single of the round (-1 DNF, -2 DNS), or null with no
   * attempt in the round at all
   */
  bestSingle: number | null;
}

export interface RankedEntrant {
  entrantId: string;
  /** Null while still in play, and for a competitor with no attempts (9f5b) */
  position: number | null;
  /** The stage of the last match the competitor is in */
  stageReached: H2hStage;
}

/** The first position of the competitors knocked out in each stage */
const FIRST_POSITION_OF_LOSERS: Partial<Record<H2hStage, number>> = {
  QUARTERFINAL: 5,
  STAGE_OF_12: 9,
  STAGE_OF_16: 9,
};

const singleRank = (single: number): number => (single > 0 ? single : Infinity);

/**
 * The round's final ranking (9f16b). The final and the third-place match give
 * positions 1 to 4. Everyone else is grouped by the stage they were knocked
 * out in, later stages first, and ordered by best single within the group.
 * Equal best singles share a position and the next one is skipped (9f15):
 * 9f16b names no further tie-break.
 */
export const rankH2hRound = (
  matches: RankingMatch[],
  entrants: RankingEntrant[],
): RankedEntrant[] => {
  const ranked = new Map<string, number>();
  const finishedWinner = (match: RankingMatch): H2hSide | null =>
    match.status === H2hMatchStatus.FINISHED ? match.winnerSide : null;

  for (const [stage, first] of [
    [H2hStage.FINAL, 1],
    [H2hStage.THIRD_PLACE, 3],
  ] as const) {
    const match = matches.find((m) => m.stage === stage);
    const winner = match ? finishedWinner(match) : null;
    if (!match || winner === null) continue;
    const [winnerId, loserId] =
      winner === H2hSide.A
        ? [match.entrantAId, match.entrantBId]
        : [match.entrantBId, match.entrantAId];
    if (winnerId !== null) ranked.set(winnerId, first);
    if (loserId !== null) ranked.set(loserId, first + 1);
  }

  // Competitors with no attempt in the round get no position (9f5b)
  const singleRanks = new Map(
    entrants.flatMap((e) =>
      e.bestSingle === null ? [] : [[e.id, singleRank(e.bestSingle)] as const],
    ),
  );
  for (const [stage, firstPosition] of Object.entries(
    FIRST_POSITION_OF_LOSERS,
  )) {
    const losers = matches
      .filter((m) => m.stage === stage && finishedWinner(m) !== null)
      .flatMap((m) => {
        const id =
          finishedWinner(m) === H2hSide.A ? m.entrantBId : m.entrantAId;
        const rank = id === null ? undefined : singleRanks.get(id);
        return id === null || rank === undefined ? [] : [{ id, rank }];
      })
      .sort((x, y) => x.rank - y.rank);
    losers.forEach(({ id, rank }) => {
      const firstEqual = losers.findIndex((other) => other.rank === rank);
      ranked.set(id, firstPosition + firstEqual);
    });
  }

  return entrants.map((entrant) => {
    const own = matches
      .filter((m) => m.entrantAId === entrant.id || m.entrantBId === entrant.id)
      .sort((x, y) => y.matchNumber - x.matchNumber);
    if (own.length === 0) {
      throw new Error(`Entrant ${entrant.id} is in no match of the bracket`);
    }
    return {
      entrantId: entrant.id,
      position:
        entrant.bestSingle === null ? null : (ranked.get(entrant.id) ?? null),
      stageReached: own[0].stage,
    };
  });
};
