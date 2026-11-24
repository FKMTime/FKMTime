import { Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from 'src/db/db.service';

import { getStages, isBracketSize, STAGE_LABELS } from './bracket';
import { matchLabels } from './bracketStore';
import { H2hMatchService } from './h2hMatch.service';
import { rankH2hRound } from './ranking';

/**
 * What a spectator may see of an attempt: its time. No id, comment, status,
 * judge, device or scramble.
 */
const publicAttemptSelect = { value: true, penalty: true } as const;

/**
 * Everything read for the public bracket, listed field by field so nothing
 * private (card ids, WCA registration ids, comments, scrambles, incidents,
 * who did what) can come along by accident. Person ids are read only to
 * work out best singles, and aren't returned.
 */
const publicBracketSelect = {
  size: true,
  status: true,
  entrants: {
    orderBy: { seed: 'asc' },
    select: {
      id: true,
      seed: true,
      person: {
        select: {
          id: true,
          name: true,
          countryIso2: true,
          registrantId: true,
        },
      },
    },
  },
  matches: {
    orderBy: { matchNumber: 'asc' },
    select: {
      id: true,
      matchNumber: true,
      stage: true,
      setsToWin: true,
      status: true,
      entrantAId: true,
      entrantBId: true,
      winnerSide: true,
      endedBy: true,
      sourceAMatch: { select: { matchNumber: true } },
      sourceAOutcome: true,
      sourceBMatch: { select: { matchNumber: true } },
      sourceBOutcome: true,
      sets: {
        orderBy: { setNumber: 'asc' },
        select: {
          setNumber: true,
          winnerSide: true,
          decidedBy: true,
          points: {
            // Raced after the set was over: they don't count anywhere
            where: { afterEnd: false },
            orderBy: { pointNumber: 'asc' },
            select: {
              pointNumber: true,
              winnerSide: true,
              decidedAt: true,
              attemptA: { select: publicAttemptSelect },
              attemptB: { select: publicAttemptSelect },
              _count: { select: { extras: true } },
            },
          },
        },
      },
    },
  },
} as const;

/** The bracket of a head-to-head round as spectators see it (SPEC-001) */
@Injectable()
export class H2hPublicService {
  constructor(
    private readonly prisma: DbService,
    private readonly h2hMatchService: H2hMatchService,
  ) {}

  async getPublicView(roundId: string) {
    const bracket = await this.prisma.h2hBracket.findUnique({
      where: { roundId },
      select: publicBracketSelect,
    });
    if (!bracket) {
      throw new NotFoundException('This round has no bracket');
    }
    const bestSingles = await this.h2hMatchService.bestSingles(
      this.prisma,
      roundId,
      bracket.entrants.map((entrant) => entrant.person.id),
    );
    const singleOf = (entrant: (typeof bracket.entrants)[number]) =>
      bestSingles.get(entrant.person.id) ?? null;
    const ranking = rankH2hRound(
      bracket.matches,
      bracket.entrants.map((entrant) => ({
        id: entrant.id,
        bestSingle: singleOf(entrant),
      })),
    );
    const labels = matchLabels(bracket.matches);
    const stages = isBracketSize(bracket.size) ? getStages(bracket.size) : [];

    return {
      roundId,
      size: bracket.size,
      status: bracket.status,
      stages: stages.map((stage) => ({
        stage,
        label: STAGE_LABELS[stage],
        setsToWin:
          bracket.matches.find((match) => match.stage === stage)?.setsToWin ??
          1,
      })),
      entrants: bracket.entrants.map((entrant) => {
        const ranked = ranking.find((r) => r.entrantId === entrant.id);
        return {
          id: entrant.id,
          seed: entrant.seed,
          name: entrant.person.name,
          countryIso2: entrant.person.countryIso2,
          // The number stations report, so the scoreboard finds their timers
          registrantId: entrant.person.registrantId,
          bestSingle: singleOf(entrant),
          position: ranked?.position ?? null,
          stageReached: ranked?.stageReached ?? null,
        };
      }),
      matches: bracket.matches.map((match) => ({
        id: match.id,
        matchNumber: match.matchNumber,
        label: labels.get(match.id) ?? `Match ${match.matchNumber}`,
        stage: match.stage,
        setsToWin: match.setsToWin,
        status: match.status,
        winnerSide: match.winnerSide,
        endedBy: match.endedBy,
        sideA: {
          entrantId: match.entrantAId,
          source: match.sourceAMatch && {
            matchNumber: match.sourceAMatch.matchNumber,
            outcome: match.sourceAOutcome,
          },
        },
        sideB: {
          entrantId: match.entrantBId,
          source: match.sourceBMatch && {
            matchNumber: match.sourceBMatch.matchNumber,
            outcome: match.sourceBOutcome,
          },
        },
        score: {
          a: match.sets.filter((set) => set.winnerSide === 'A').length,
          b: match.sets.filter((set) => set.winnerSide === 'B').length,
        },
        sets: match.sets.map((set) => ({
          setNumber: set.setNumber,
          winnerSide: set.winnerSide,
          decidedBy: set.decidedBy,
          points: set.points.map((point) => ({
            pointNumber: point.pointNumber,
            winnerSide: point.winnerSide,
            decided: point.decidedAt !== null,
            a: point.attemptA,
            b: point.attemptB,
            // Raced again on a fresh scramble (11k1)
            extraGranted: point._count.extras > 0,
          })),
        })),
      })),
    };
  }
}
