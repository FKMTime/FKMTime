import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { activityCodeToName } from '@wca/helpers';
import { AppGateway } from 'src/app.gateway';
import { DbService, runInTransaction } from 'src/db/db.service';
import { bySetLetter } from 'src/scramble-set/setLetters';
import { Competition, getRoundInfoFromWcif } from 'wcif-helpers';

import { AttemptStatus, H2hMatchStatus } from '../generated/prisma/client';
import {
  getStages,
  isBracketSize,
  SetsToWinByStage,
  STAGE_LABELS,
  validateSetsToWin,
} from './bracket';
import {
  applySeeds,
  createBracket,
  lockBracket,
  matchLabels,
  NOT_STARTED,
  rematchScramblePlan,
  resizePlan,
  setsToWinOf,
} from './bracketStore';
import { CreateBracketDto } from './dto/createBracket.dto';
import { UpdateBracketDto } from './dto/updateBracket.dto';
import { UpdateScramblePlanDto } from './dto/updateScramblePlan.dto';
import { UpdateSeedsDto } from './dto/updateSeeds.dto';
import { H2hExportService } from './h2hExport.service';
import { H2hMatchService } from './h2hMatch.service';
import { whyNoBracket } from './h2hRound';
import {
  amendedAfter,
  holdSharedScrambles,
  nextScramble,
  whyNoReopen,
} from './matchEngine';
import { rankH2hRound } from './ranking';
import { countPlannedSets } from './scramblePlan';
import { seedFromPreviousRound, suggestBracketSize } from './seeding';

const personSelect = {
  id: true,
  name: true,
  wcaId: true,
  registrantId: true,
  countryIso2: true,
} as const;

/** Raced: the H2H set it belongs to has started */
const scrambleSetSelect = {
  id: true,
  set: true,
  h2hSet: { select: { id: true } },
  h2hPlan: { select: { id: true } },
  scrambles: {
    select: {
      id: true,
      num: true,
      isExtra: true,
      h2hPoint: { select: { id: true } },
      h2hPointExtra: { select: { id: true } },
    },
  },
} as const;

const attemptViewSelect = {
  id: true,
  attemptNumber: true,
  value: true,
  penalty: true,
  status: true,
} as const;

/** A set of a match with its points, as the Matches tab shows them */
const setViewSelect = {
  id: true,
  setNumber: true,
  winnerSide: true,
  decidedBy: true,
  scrambleSet: { select: { id: true, set: true } },
  points: {
    orderBy: { pointNumber: 'asc' },
    select: {
      id: true,
      pointNumber: true,
      winnerSide: true,
      decidedAt: true,
      afterEnd: true,
      attemptAId: true,
      attemptBId: true,
      attemptA: { select: attemptViewSelect },
      attemptB: { select: attemptViewSelect },
      scramble: {
        select: {
          num: true,
          isExtra: true,
          scrambleSet: { select: { id: true, set: true } },
        },
      },
      // Races replaced by an extra, oldest first
      extras: {
        orderBy: { createdAt: 'asc' },
        select: {
          attemptA: { select: attemptViewSelect },
          attemptB: { select: attemptViewSelect },
        },
      },
    },
  },
} as const;

type ScrambleText = { set: string; num: number; isExtra: boolean };

/** "Set C, scramble 4", or "Set C, extra 1" */
const scrambleText = (scramble: ScrambleText) =>
  `Set ${scramble.set}, ${scramble.isExtra ? 'extra' : 'scramble'} ${scramble.num}`;

@Injectable()
export class H2hService {
  constructor(
    private readonly prisma: DbService,
    @Inject(forwardRef(() => AppGateway))
    private readonly appGateway: AppGateway,
    private readonly h2hMatchService: H2hMatchService,
    private readonly h2hExport: H2hExportService,
  ) {}

  private async getWcif(): Promise<Competition> {
    const competition = await this.prisma.competition.findFirst({
      select: { wcif: true },
    });
    if (!competition) throw new NotFoundException('Competition not found');
    return competition.wcif as unknown as Competition;
  }

  /** Why the round can't have a bracket; a 404 when it isn't in the WCIF */
  private whyNoBracket(roundId: string, wcif: Competition): string | null {
    if (!getRoundInfoFromWcif(roundId, wcif)) {
      throw new NotFoundException('Round not found');
    }
    return whyNoBracket(roundId, wcif);
  }

  /** The bracket, its setup and its scramble plan, for the staff screens */
  async getBracketView(roundId: string) {
    const wcif = await this.getWcif();
    const cannotCreate = this.whyNoBracket(roundId, wcif);
    const eventId = roundId.split('-r')[0];
    const registeredIds = wcif.persons
      .filter(
        (person) =>
          person.registration?.status === 'accepted' &&
          person.registration.eventIds.includes(eventId as never),
      )
      .map((person) => person.registrantId);
    const [bracket, candidates, scrambleSets] = await Promise.all([
      this.prisma.h2hBracket.findUnique({
        where: { roundId },
        include: {
          entrants: {
            orderBy: { seed: 'asc' },
            include: { person: { select: personSelect } },
          },
          matches: {
            orderBy: { matchNumber: 'asc' },
            include: {
              sourceAMatch: { select: { matchNumber: true } },
              sourceBMatch: { select: { matchNumber: true } },
              scrambleAssignments: { orderBy: { setNumber: 'asc' } },
              sets: { orderBy: { setNumber: 'asc' }, select: setViewSelect },
              logs: {
                orderBy: { createdAt: 'asc' },
                select: {
                  action: true,
                  side: true,
                  comment: true,
                  createdAt: true,
                  createdBy: { select: { fullName: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.person.findMany({
        where: { registrantId: { in: registeredIds } },
        select: personSelect,
        orderBy: { name: 'asc' },
      }),
      this.prisma.scrambleSet.findMany({
        where: { roundId },
        select: scrambleSetSelect,
      }),
    ]);
    const base = {
      roundId,
      eventId,
      cannotCreate,
      suggestedSize: suggestBracketSize(roundId, wcif),
      candidates,
    };
    if (!bracket) return { ...base, bracket: null, scramblePlan: null };

    const labels = matchLabels(bracket.matches);
    const hasStarted = (match: { status: string; startedAt: Date | null }) =>
      !NOT_STARTED.includes(match.status as never) || match.startedAt !== null;
    const stages = isBracketSize(bracket.size) ? getStages(bracket.size) : [];
    const rows = bracket.matches.flatMap((match) =>
      match.scrambleAssignments.map((row) => ({
        id: row.id,
        matchId: match.id,
        matchNumber: match.matchNumber,
        matchLabel: labels.get(match.id) ?? `Match ${match.matchNumber}`,
        setNumber: row.setNumber,
        scrambleSetId: row.scrambleSetId,
        // A set that has started keeps the scramble set it is raced on
        locked: match.sets.some((set) => set.setNumber === row.setNumber),
      })),
    );
    const plannedSets = countPlannedSets(bracket.matches);
    const bestSingles = await this.h2hMatchService.bestSingles(
      this.prisma,
      roundId,
      bracket.entrants.map((entrant) => entrant.person.id),
    );
    const amended = await this.amendedAttemptIds(bracket.matches);
    const entrantById = new Map(bracket.entrants.map((e) => [e.id, e]));
    const labelOf = (matchId: string) => labels.get(matchId) ?? 'another match';
    /** Why Reopen match would be refused, so the tab says so up front */
    const reopenRefusal = (match: (typeof bracket.matches)[number]) => {
      if (match.status !== H2hMatchStatus.FINISHED) return null;
      const refusal = whyNoReopen(
        match,
        {
          a: (match.entrantAId && entrantById.get(match.entrantAId)) || null,
          b: (match.entrantBId && entrantById.get(match.entrantBId)) || null,
        },
        bracket.matches,
      );
      if (!refusal) return null;
      if (refusal.kind === 'fedStarted') {
        return `${labelOf(refusal.matchId)}, which follows from it, has started`;
      }
      const name = entrantById.get(refusal.entrantId)?.person.name;
      return refusal.matchId
        ? `${name} withdrew in ${labelOf(refusal.matchId)}: reopen that match instead`
        : `${name} withdrew earlier: reopen the match they withdrew from instead`;
    };
    const inUse = this.scramblesInUse(bracket.matches, labels, scrambleSets);
    const ranking = rankH2hRound(
      bracket.matches,
      bracket.entrants.map((entrant) => ({
        id: entrant.id,
        bestSingle: bestSingles.get(entrant.person.id) ?? null,
      })),
    );
    return {
      ...base,
      bracket: {
        id: bracket.id,
        size: bracket.size,
        status: bracket.status,
        wcaRoundId: bracket.wcaRoundId,
        // A withdrawal locks them too: new seeds would drop it
        seedsLocked:
          bracket.matches.some(hasStarted) ||
          bracket.entrants.some((entrant) => entrant.withdrawnAt !== null),
        attemptsLinked: bracket.matches.some((match) =>
          match.sets.some((set) =>
            set.points.some(
              (point) =>
                point.attemptAId !== null ||
                point.attemptBId !== null ||
                point.extras.length > 0,
            ),
          ),
        ),
        stages: stages.map((stage) => {
          const inStage = bracket.matches.filter((m) => m.stage === stage);
          return {
            stage,
            label: STAGE_LABELS[stage],
            setsToWin: inStage[0]?.setsToWin ?? 1,
            started: inStage.some(hasStarted),
          };
        }),
        entrants: bracket.entrants.map((entrant) => {
          const ranked = ranking.find((r) => r.entrantId === entrant.id);
          return {
            id: entrant.id,
            seed: entrant.seed,
            seedTieBroken: entrant.seedTieBroken,
            withdrawnAt: entrant.withdrawnAt,
            withdrawnInMatchId: entrant.withdrawnInMatchId,
            person: entrant.person,
            bestSingle: bestSingles.get(entrant.person.id) ?? null,
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
          startedAt: match.startedAt,
          finishedAt: match.finishedAt,
          reopenRefusal: reopenRefusal(match),
          score: {
            a: match.sets.filter((set) => set.winnerSide === 'A').length,
            b: match.sets.filter((set) => set.winnerSide === 'B').length,
          },
          sets: match.sets.map((set) => ({
            setNumber: set.setNumber,
            winnerSide: set.winnerSide,
            decidedBy: set.decidedBy,
            scrambleSet: set.scrambleSet,
            points: set.points.map((point) => ({
              id: point.id,
              pointNumber: point.pointNumber,
              winnerSide: point.winnerSide,
              decided: point.decidedAt !== null,
              afterEnd: point.afterEnd,
              attemptA: point.attemptA,
              attemptB: point.attemptB,
              extras: point.extras,
              // A time changed after the match, which kept its winner (11l1)
              amendedAfterMatch: [point.attemptAId, point.attemptBId].some(
                (id) => id !== null && amended.has(id),
              ),
              scramble: point.scramble && {
                set: point.scramble.scrambleSet.set,
                num: point.scramble.num,
                isExtra: point.scramble.isExtra,
              },
            })),
          })),
          scrambleInUse: inUse.get(match.id) ?? null,
          log: match.logs.map((entry) => ({
            action: entry.action,
            side: entry.side,
            comment: entry.comment,
            createdAt: entry.createdAt,
            createdBy: entry.createdBy?.fullName ?? null,
          })),
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
        })),
      },
      scramblePlan: {
        plannedSets,
        instruction: `Set the scramble set count for ${activityCodeToName(roundId)} to ${plannedSets} on the WCA website, then generate scrambles in TNoodle. A couple of spare sets on top are recommended.`,
        rows,
        scrambleSets: [...scrambleSets].sort(bySetLetter).map((set) => ({
          id: set.id,
          set: set.set,
          scramblesCount: set.scrambles.filter((s) => !s.isExtra).length,
          extraScramblesCount: set.scrambles.filter((s) => s.isExtra).length,
          raced:
            set.h2hSet !== null ||
            set.scrambles.some(
              (s) => s.h2hPoint !== null || s.h2hPointExtra !== null,
            ),
        })),
      },
    };
  }

  /**
   * Attempts on points of finished matches whose time changed after the
   * match finished: the match kept its winners (11l1), and the staff screen
   * says so. Worked out from the attempts' edit logs rather than stored.
   */
  private async amendedAttemptIds(
    matches: {
      finishedAt: Date | null;
      sets: {
        points: {
          attemptA: {
            id: string;
            value: number;
            penalty: number | null;
          } | null;
          attemptB: {
            id: string;
            value: number;
            penalty: number | null;
          } | null;
        }[];
      }[];
    }[],
  ) {
    const finishedAtOf = new Map<
      string,
      { finishedAt: Date; value: number; penalty: number | null }
    >();
    for (const match of matches) {
      const { finishedAt } = match;
      if (finishedAt === null) continue;
      for (const point of match.sets.flatMap((set) => set.points)) {
        for (const attempt of [point.attemptA, point.attemptB]) {
          if (attempt) finishedAtOf.set(attempt.id, { ...attempt, finishedAt });
        }
      }
    }
    if (finishedAtOf.size === 0) return new Set<string>();
    const logs = await this.prisma.attemptEditLog.findMany({
      where: { attemptId: { in: [...finishedAtOf.keys()] } },
      select: { attemptId: true, editedAt: true, value: true, penalty: true },
    });
    const logsOf = new Map<string, typeof logs>();
    for (const log of logs) {
      const list = logsOf.get(log.attemptId);
      if (list) list.push(log);
      else logsOf.set(log.attemptId, [log]);
    }
    return new Set(
      [...finishedAtOf].flatMap(([id, attempt]) =>
        amendedAfter(attempt.finishedAt, logsOf.get(id) ?? [], attempt)
          ? [id]
          : [],
      ),
    );
  }

  /**
   * The scramble the playing match's next point races, as the scramble team
   * reads it: "Quarterfinal 3 · set 1 · Set C, scramble 4". The open point's
   * own when one competitor is in already, otherwise the one the next
   * point will take. A warning instead when none is left, and while an
   * incident on the last point is open: it may be raced again.
   */
  private scrambleInUse(
    match: {
      sets: {
        setNumber: number;
        winnerSide: string | null;
        scrambleSet: { id: string } | null;
        points: {
          pointNumber: number;
          decidedAt: Date | null;
          attemptA: { status: AttemptStatus } | null;
          attemptB: { status: AttemptStatus } | null;
          scramble: {
            num: number;
            isExtra: boolean;
            scrambleSet: { id: string; set: string };
          } | null;
        }[];
      }[];
    },
    label: string,
    scrambleSets: {
      id: string;
      set: string;
      h2hSet: { id: string } | null;
      h2hPlan: { id: string } | null;
      scrambles: {
        id: string;
        num: number;
        isExtra: boolean;
        h2hPoint: { id: string } | null;
        h2hPointExtra: { id: string } | null;
      }[];
    }[],
  ) {
    const set = match.sets.find((s) => s.winnerSide === null);
    if (!set) return null;
    const where = `${label} · set ${set.setNumber}`;
    const isIncident = (attempt: { status: AttemptStatus } | null) =>
      attempt?.status === AttemptStatus.UNRESOLVED;
    const open = set.points.find(
      (point) =>
        point.attemptA === null ||
        point.attemptB === null ||
        isIncident(point.attemptA) ||
        isIncident(point.attemptB),
    );
    if (open) {
      const scramble = open.scramble && {
        scrambleSetId: open.scramble.scrambleSet.id,
        set: open.scramble.scrambleSet.set,
        num: open.scramble.num,
        isExtra: open.scramble.isExtra,
      };
      return {
        setNumber: set.setNumber,
        pointNumber: open.pointNumber,
        scramble,
        predicted: false,
        text: scramble ? `${where} · ${scrambleText(scramble)}` : where,
        where,
        warning:
          isIncident(open.attemptA) || isIncident(open.attemptB)
            ? `An incident on point ${open.pointNumber} is open. Wait for the delegate: the point may be raced again.`
            : null,
      };
    }
    const toOption = (s: (typeof scrambleSets)[number]) => ({
      id: s.id,
      set: s.set,
      scrambles: s.scrambles.map((scramble) => ({
        id: scramble.id,
        num: scramble.num,
        isExtra: scramble.isExtra,
        used: scramble.h2hPoint !== null || scramble.h2hPointExtra !== null,
      })),
    });
    const own = scrambleSets.find((s) => s.id === set.scrambleSet?.id);
    const next = nextScramble(
      own ? toOption(own) : null,
      scrambleSets
        .filter((s) => s.h2hPlan === null && s.h2hSet === null)
        .map(toOption),
    );
    const pointNumber =
      (set.points[set.points.length - 1]?.pointNumber ?? 0) + 1;
    if (!next) {
      return {
        setNumber: set.setNumber,
        pointNumber,
        scramble: null,
        predicted: false,
        text: where,
        where,
        warning: `No scramble is left for point ${pointNumber}. Import more scramble sets for this round.`,
      };
    }
    return {
      setNumber: set.setNumber,
      pointNumber,
      scramble: {
        scrambleSetId: next.scrambleSetId,
        set: next.set,
        num: next.num,
        isExtra: next.isExtra,
      },
      predicted: true,
      text: `${where} · ${scrambleText(next)}`,
      where,
      warning: next.fromSpare
        ? `${own ? `Set ${own.set}` : 'This set'} is used up, so the next point takes Set ${next.set} from the spares. Hand it to the scramblers.`
        : null,
    };
  }

  /**
   * What the scrambling device shows for the round (SPEC-001, On the day):
   * each playing match's set and the scramble its next point races, in
   * match order
   */
  async getPlayingScrambles(roundId: string) {
    const [bracket, scrambleSets] = await Promise.all([
      this.prisma.h2hBracket.findUnique({
        where: { roundId },
        select: {
          matches: {
            orderBy: { matchNumber: 'asc' },
            select: {
              id: true,
              stage: true,
              matchNumber: true,
              status: true,
              sets: { orderBy: { setNumber: 'asc' }, select: setViewSelect },
            },
          },
        },
      }),
      this.prisma.scrambleSet.findMany({
        where: { roundId },
        select: scrambleSetSelect,
      }),
    ]);
    if (!bracket) return [];
    const labels = matchLabels(bracket.matches);
    const inUse = this.scramblesInUse(bracket.matches, labels, scrambleSets);
    return bracket.matches.flatMap((match) => {
      const scramble = inUse.get(match.id);
      return scramble
        ? [
            {
              matchId: match.id,
              label: labels.get(match.id) ?? `Match ${match.matchNumber}`,
              ...scramble,
            },
          ]
        : [];
    });
  }

  /**
   * The next scramble of every playing match, by match id. Matches that
   * would take the same spare scramble are held but the first (see
   * holdSharedScrambles).
   */
  private scramblesInUse(
    matches: (Parameters<H2hService['scrambleInUse']>[0] & {
      id: string;
      matchNumber: number;
      status: H2hMatchStatus;
    })[],
    labels: Map<string, string>,
    scrambleSets: Parameters<H2hService['scrambleInUse']>[2],
  ) {
    const playing = [...matches]
      .filter((match) => match.status === H2hMatchStatus.IN_PROGRESS)
      .sort((x, y) => x.matchNumber - y.matchNumber)
      .flatMap((match) => {
        const label = labels.get(match.id) ?? `Match ${match.matchNumber}`;
        const inUse = this.scrambleInUse(match, label, scrambleSets);
        const decided = match.sets
          .flatMap((set) => set.points)
          .flatMap((point) => (point.decidedAt ? [point.decidedAt] : []));
        const waitingSince =
          decided.length > 0
            ? new Date(Math.max(...decided.map((d) => d.getTime())))
            : null;
        return inUse
          ? [
              {
                ...inUse,
                label,
                matchId: match.id,
                matchNumber: match.matchNumber,
                waitingSince,
              },
            ]
          : [];
      });
    return new Map(
      holdSharedScrambles(playing).map((entry) => [
        entry.matchId,
        {
          setNumber: entry.setNumber,
          pointNumber: entry.pointNumber,
          scramble: entry.scramble,
          text: entry.text,
          warning: entry.warning,
        },
      ]),
    );
  }

  /**
   * Creates the round's bracket and seeds it from the previous round (I1b);
   * the notice says what the delegate still has to do by hand
   */
  async createBracket(roundId: string, dto: CreateBracketDto) {
    const wcif = await this.getWcif();
    const cannotCreate = this.whyNoBracket(roundId, wcif);
    if (cannotCreate) throw new BadRequestException(cannotCreate);
    const size = dto.size ?? suggestBracketSize(roundId, wcif);
    if (size === null || !isBracketSize(size)) {
      throw new BadRequestException('Choose a bracket size: 4, 8, 12 or 16');
    }
    const setsToWin: SetsToWinByStage = {
      ...Object.fromEntries(getStages(size).map((stage) => [stage, 1])),
      ...dto.setsToWin,
    };
    const errors = validateSetsToWin(size, setsToWin);
    if (errors.length > 0) throw new BadRequestException(errors.join('. '));

    const seeding = seedFromPreviousRound(roundId, wcif, size);
    const persons = await this.prisma.person.findMany({
      where: {
        registrantId: { in: seeding.seeds.map((seed) => seed.registrantId) },
      },
      select: { id: true, registrantId: true },
    });
    const seeds = seeding.seeds.flatMap((seed) => {
      const person = persons.find((p) => p.registrantId === seed.registrantId);
      return person
        ? [{ personId: person.id, seedTieBroken: seed.tieBroken }]
        : [];
    });
    const notices = [seeding.notice];
    if (seeds.length < seeding.seeds.length) {
      notices.push(
        `${seeding.seeds.length - seeds.length} competitors from the ranking aren't in FKMTime and were left out. Add the missing seeds by hand.`,
      );
    }

    await runInTransaction(this.prisma, async (tx) => {
      // Before the check, so a second request at the same moment gets a 409
      await lockBracket(tx.db, roundId);
      tx.afterCommit(() => this.appGateway.handleH2hUpdated(roundId));
      if (await tx.db.h2hBracket.findUnique({ where: { roundId } })) {
        throw new ConflictException('This round already has a bracket');
      }
      await createBracket(tx.db, {
        roundId,
        eventId: roundId.split('-r')[0],
        size,
        setsToWin,
        seeds,
      });
    });
    // Fetched in the background, so the delegate sees it on the Bracket tab
    // long before the export needs it (h2hUpdated says when), without
    // waiting on the WCA at a venue without internet. The export tries
    // again if this fails.
    void this.h2hExport.fillWcaRoundId(roundId).catch(() => null);
    return {
      ...(await this.getBracketView(roundId)),
      notice: notices.filter((n) => n !== null).join(' ') || null,
    };
  }

  /** Reorders or replaces the competitors, until the first match starts */
  async updateSeeds(roundId: string, dto: UpdateSeedsDto) {
    await runInTransaction(this.prisma, async (tx) => {
      await lockBracket(tx.db, roundId);
      tx.afterCommit(() => this.appGateway.handleH2hUpdated(roundId));
      const bracket = await tx.db.h2hBracket.findUnique({
        where: { roundId },
        include: { matches: true, entrants: true },
      });
      if (!bracket) {
        throw new NotFoundException('This round has no bracket yet');
      }
      if (
        bracket.matches.some(
          (m) =>
            m.startedAt !== null || m.status === H2hMatchStatus.IN_PROGRESS,
        )
      ) {
        throw new ConflictException(
          "The seeds can't change once a match has started",
        );
      }
      // New seeds would drop the withdrawal, and the walkovers it gave
      if (
        bracket.entrants.some((e) => e.withdrawnAt !== null) ||
        bracket.matches.some((m) => m.status === H2hMatchStatus.FINISHED)
      ) {
        throw new ConflictException(
          "The seeds can't change once a competitor has withdrawn. To start over, delete the bracket and create it again.",
        );
      }
      if (dto.personIds.length > bracket.size) {
        throw new BadRequestException(
          `The bracket has ${bracket.size} places, and ${dto.personIds.length} competitors were given`,
        );
      }
      const known = await tx.db.person.count({
        where: { id: { in: dto.personIds } },
      });
      if (known !== dto.personIds.length) {
        throw new BadRequestException(
          'Some of these competitors are not in FKMTime',
        );
      }
      await applySeeds(
        tx.db,
        bracket.id,
        dto.personIds.map((personId, i) => {
          const before = bracket.entrants.find((e) => e.personId === personId);
          // A random tie-break stays marked only while nobody moved it
          return {
            personId,
            seedTieBroken: before?.seed === i + 1 && before.seedTieBroken,
          };
        }),
      );
    });
    return this.getBracketView(roundId);
  }

  /** Changes the WCA round id, and sets to win of stages not started yet */
  async updateBracket(roundId: string, dto: UpdateBracketDto) {
    await runInTransaction(this.prisma, async (tx) => {
      await lockBracket(tx.db, roundId);
      tx.afterCommit(() => this.appGateway.handleH2hUpdated(roundId));
      const bracket = await tx.db.h2hBracket.findUnique({
        where: { roundId },
        include: { matches: true },
      });
      if (!bracket) {
        throw new NotFoundException('This round has no bracket yet');
      }
      if (dto.wcaRoundId !== undefined) {
        await tx.db.h2hBracket.update({
          where: { id: bracket.id },
          data: { wcaRoundId: dto.wcaRoundId },
        });
      }
      if (!dto.setsToWin || !isBracketSize(bracket.size)) return;
      const current = setsToWinOf(bracket.matches);
      const wanted: SetsToWinByStage = { ...current, ...dto.setsToWin };
      const errors = validateSetsToWin(bracket.size, wanted);
      if (errors.length > 0) throw new BadRequestException(errors.join('. '));
      const changed = getStages(bracket.size).filter(
        (stage) => wanted[stage] !== current[stage],
      );
      for (const stage of changed) {
        const started = bracket.matches.some(
          (m) =>
            m.stage === stage &&
            (!NOT_STARTED.includes(m.status) || m.startedAt !== null),
        );
        if (started) {
          throw new ConflictException(
            `The ${STAGE_LABELS[stage]} has started, so its sets to win can't change`,
          );
        }
      }
      if (changed.length === 0) return;
      for (const stage of changed) {
        await tx.db.h2hMatch.updateMany({
          where: { bracketId: bracket.id, stage },
          data: { setsToWin: wanted[stage] },
        });
      }
      await resizePlan(
        tx.db,
        bracket.matches.map((match) => ({
          ...match,
          setsToWin: wanted[match.stage] ?? match.setsToWin,
        })),
      );
      await rematchScramblePlan(tx.db, roundId);
    });
    return this.getBracketView(roundId);
  }

  /** Deletes the bracket, while no attempt is linked to it */
  async deleteBracket(roundId: string) {
    await runInTransaction(this.prisma, async (tx) => {
      await lockBracket(tx.db, roundId);
      tx.afterCommit(() => this.appGateway.handleH2hUpdated(roundId));
      const bracket = await tx.db.h2hBracket.findUnique({
        where: { roundId },
      });
      if (!bracket) {
        throw new NotFoundException('This round has no bracket yet');
      }
      const linked = await tx.db.h2hPoint.count({
        where: {
          set: { match: { bracketId: bracket.id } },
          OR: [
            { attemptAId: { not: null } },
            { attemptBId: { not: null } },
            { extras: { some: {} } },
          ],
        },
      });
      if (linked > 0) {
        throw new ConflictException(
          "The bracket can't be deleted once attempts are recorded in its matches",
        );
      }
      // Everything in it goes too
      await tx.db.h2hBracket.delete({ where: { id: bracket.id } });
    });
  }

  /**
   * Changes plan rows. A row takes any set of the round that no other row
   * plans and no match has raced; a row already raced keeps its set.
   */
  async updateScramblePlan(roundId: string, dto: UpdateScramblePlanDto) {
    await runInTransaction(this.prisma, async (tx) => {
      await lockBracket(tx.db, roundId);
      tx.afterCommit(() => this.appGateway.handleH2hUpdated(roundId));
      const bracket = await tx.db.h2hBracket.findUnique({
        where: { roundId },
        include: {
          matches: { include: { scrambleAssignments: true, sets: true } },
        },
      });
      if (!bracket) {
        throw new NotFoundException('This round has no bracket yet');
      }
      const labels = matchLabels(bracket.matches);
      const rows = bracket.matches.flatMap((match) =>
        match.scrambleAssignments.map((row) => ({
          ...row,
          label: `${labels.get(match.id)}, set ${row.setNumber}`,
          locked: match.sets.some((set) => set.setNumber === row.setNumber),
        })),
      );
      const sets = await tx.db.scrambleSet.findMany({
        where: { roundId },
        select: scrambleSetSelect,
      });
      const after = new Map(rows.map((row) => [row.id, row.scrambleSetId]));
      for (const edit of dto.rows) {
        const row = rows.find((r) => r.id === edit.id);
        if (!row) {
          throw new NotFoundException(
            'A row of the plan to change is not in this bracket',
          );
        }
        if (row.scrambleSetId === edit.scrambleSetId) continue;
        if (row.locked) {
          throw new ConflictException(
            `${row.label} has been raced, so its scramble set can't change`,
          );
        }
        if (edit.scrambleSetId !== null) {
          const set = sets.find((s) => s.id === edit.scrambleSetId);
          if (!set) {
            throw new BadRequestException(
              `That scramble set is not one of ${activityCodeToName(roundId)}'s`,
            );
          }
          const raced =
            set.h2hSet !== null ||
            set.scrambles.some((s) => s.h2hPoint !== null);
          if (raced) {
            throw new ConflictException(
              `Set ${set.set} has been raced already, so no other match can use it`,
            );
          }
        }
        after.set(row.id, edit.scrambleSetId);
      }
      const planned = new Map<string, string[]>();
      for (const row of rows) {
        const setId = after.get(row.id);
        if (!setId) continue;
        planned.set(setId, [...(planned.get(setId) ?? []), row.label]);
      }
      for (const [setId, usedBy] of planned) {
        if (usedBy.length > 1) {
          const letter = sets.find((s) => s.id === setId)?.set ?? '';
          throw new BadRequestException(
            `Set ${letter} can only be in one place in the plan, and it is planned for ${usedBy.join(' and ')}`,
          );
        }
      }
      // Clear first, so two rows can swap sets
      const changed = rows.filter(
        (row) => after.get(row.id) !== row.scrambleSetId,
      );
      await tx.db.h2hScrambleAssignment.updateMany({
        where: { id: { in: changed.map((row) => row.id) } },
        data: { scrambleSetId: null },
      });
      for (const row of changed) {
        const setId = after.get(row.id);
        if (!setId) continue;
        await tx.db.h2hScrambleAssignment.update({
          where: { id: row.id },
          data: { scrambleSetId: setId },
        });
      }
    });
    return this.getBracketView(roundId);
  }
}
