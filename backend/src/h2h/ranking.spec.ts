import { H2hMatchStatus, H2hSide, H2hStage } from '../generated/prisma/client';
import { rankH2hRound, RankingEntrant, RankingMatch } from './ranking';

const DNF = -1;

type MatchWithoutNumber = Omit<RankingMatch, 'matchNumber'>;

const match = (
  stage: H2hStage,
  a: string,
  b: string,
  winnerSide: H2hSide | null = H2hSide.A,
): MatchWithoutNumber => ({
  stage,
  status:
    winnerSide === null ? H2hMatchStatus.IN_PROGRESS : H2hMatchStatus.FINISHED,
  entrantAId: a,
  entrantBId: b,
  winnerSide,
});

const numbered = (matches: MatchWithoutNumber[]): RankingMatch[] =>
  matches.map((m, i) => ({ ...m, matchNumber: i + 1 }));

/** An 8-competitor bracket where s1…s8 are the seeds; the higher seed wins unless told */
const eightPlayed = (finalWinner: H2hSide | null = H2hSide.A) =>
  numbered([
    match(H2hStage.QUARTERFINAL, 's1', 's8'),
    match(H2hStage.QUARTERFINAL, 's4', 's5'),
    match(H2hStage.QUARTERFINAL, 's3', 's6'),
    match(H2hStage.QUARTERFINAL, 's2', 's7'),
    match(H2hStage.SEMIFINAL, 's1', 's4'),
    match(H2hStage.SEMIFINAL, 's2', 's3'),
    match(H2hStage.THIRD_PLACE, 's3', 's4', H2hSide.B),
    match(H2hStage.FINAL, 's1', 's2', finalWinner),
  ]);

const entrants = (bestSingles: Record<string, number | null>) =>
  Object.entries(bestSingles).map(([id, bestSingle]): RankingEntrant => ({
    id,
    bestSingle,
  }));

const positions = (ranked: ReturnType<typeof rankH2hRound>) =>
  Object.fromEntries(ranked.map((r) => [r.entrantId, r.position]));

describe('rankH2hRound', () => {
  it('ranks the final and third-place match 1 to 4, then quarterfinal losers by best single', () => {
    const ranked = rankH2hRound(
      eightPlayed(H2hSide.B),
      entrants({
        s1: 900,
        s2: 950,
        s3: 800,
        s4: 1000,
        s5: 1100,
        s6: 1050,
        s7: DNF,
        s8: 1200,
      }),
    );

    expect(positions(ranked)).toEqual({
      s2: 1,
      s1: 2,
      s4: 3,
      s3: 4,
      s6: 5,
      s5: 6,
      s8: 7,
      s7: 8,
    });
  });

  it('lets equal best singles in a stage share a position and skips the next', () => {
    const ranked = rankH2hRound(
      eightPlayed(),
      entrants({
        s1: 900,
        s2: 950,
        s3: 800,
        s4: 1000,
        s5: 1100,
        s6: 1100,
        s7: 1300,
        s8: 1050,
      }),
    );

    expect(positions(ranked)).toMatchObject({ s8: 5, s5: 6, s6: 6, s7: 8 });
  });

  it('ranks Stage of 16 losers from 9th', () => {
    const matches = numbered([
      match(H2hStage.STAGE_OF_16, 's1', 's16'),
      match(H2hStage.QUARTERFINAL, 's1', 's8'),
    ]);

    const ranked = rankH2hRound(
      matches,
      entrants({ s1: 900, s16: 1500, s8: 1000 }),
    );

    expect(positions(ranked)).toEqual({ s1: null, s16: 9, s8: 5 });
  });

  it('leaves out a competitor with no attempts in the round', () => {
    const ranked = rankH2hRound(
      eightPlayed(),
      entrants({
        s1: 900,
        s2: 950,
        s3: 800,
        s4: 1000,
        s5: 1100,
        s6: 1050,
        s7: null,
        s8: 1200,
      }),
    );

    expect(positions(ranked)).toMatchObject({ s6: 5, s5: 6, s8: 7, s7: null });
  });

  it('gives no position to the finalists while the final is playing', () => {
    const ranked = rankH2hRound(
      eightPlayed(null),
      entrants({ s1: 900, s2: 950, s3: 800, s4: 1000 }),
    );

    expect(positions(ranked)).toEqual({ s1: null, s2: null, s3: 4, s4: 3 });
  });

  it('says which stage each competitor reached', () => {
    const ranked = rankH2hRound(
      eightPlayed(),
      entrants({ s1: 900, s3: 800, s8: 1200 }),
    );

    expect(
      Object.fromEntries(ranked.map((r) => [r.entrantId, r.stageReached])),
    ).toEqual({
      s1: H2hStage.FINAL,
      s3: H2hStage.THIRD_PLACE,
      s8: H2hStage.QUARTERFINAL,
    });
  });
});
