import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { activityCodeToName } from '@wca/helpers';
import { DbService, runInTransaction } from 'src/db/db.service';
import { bySetLetter } from 'src/scramble-set/setLetters';
import { Competition, getRoundInfoFromWcif } from 'wcif-helpers';

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
import { whyNoBracket } from './h2hRound';
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
  scrambles: {
    select: { isExtra: true, h2hPoint: { select: { id: true } } },
  },
} as const;

@Injectable()
export class H2hService {
  constructor(private readonly prisma: DbService) {}

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
              sets: {
                select: {
                  setNumber: true,
                  points: {
                    select: { attemptAId: true, attemptBId: true },
                  },
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
    return {
      ...base,
      bracket: {
        id: bracket.id,
        size: bracket.size,
        status: bracket.status,
        wcaRoundId: bracket.wcaRoundId,
        seedsLocked: bracket.matches.some(hasStarted),
        attemptsLinked: bracket.matches.some((match) =>
          match.sets.some((set) =>
            set.points.some(
              (point) => point.attemptAId !== null || point.attemptBId !== null,
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
        entrants: bracket.entrants.map((entrant) => ({
          id: entrant.id,
          seed: entrant.seed,
          seedTieBroken: entrant.seedTieBroken,
          withdrawnAt: entrant.withdrawnAt,
          person: entrant.person,
        })),
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
            set.scrambles.some((s) => s.h2hPoint !== null),
        })),
      },
    };
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
    return {
      ...(await this.getBracketView(roundId)),
      notice: notices.filter((n) => n !== null).join(' ') || null,
    };
  }

  /** Reorders or replaces the competitors, until the first match starts */
  async updateSeeds(roundId: string, dto: UpdateSeedsDto) {
    await runInTransaction(this.prisma, async (tx) => {
      await lockBracket(tx.db, roundId);
      const bracket = await tx.db.h2hBracket.findUnique({
        where: { roundId },
        include: { matches: true, entrants: true },
      });
      if (!bracket) {
        throw new NotFoundException('This round has no bracket yet');
      }
      if (
        bracket.matches.some(
          (m) => !NOT_STARTED.includes(m.status) || m.startedAt !== null,
        )
      ) {
        throw new ConflictException(
          "The seeds can't change once a match has started",
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
      const bracket = await tx.db.h2hBracket.findUnique({
        where: { roundId },
      });
      if (!bracket) {
        throw new NotFoundException('This round has no bracket yet');
      }
      const linked = await tx.db.h2hPoint.count({
        where: {
          set: { match: { bracketId: bracket.id } },
          OR: [{ attemptAId: { not: null } }, { attemptBId: { not: null } }],
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
