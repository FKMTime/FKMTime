import {
  ConflictException,
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { AppGateway } from 'src/app.gateway';
import { DbService } from 'src/db/db.service';
import { decryptScramble } from 'src/scrambling/scrambleCrypto';
import { WcaService } from 'src/wca/wca.service';

import { matchLabels } from './bracketStore';
import { H2hMatchService } from './h2hMatch.service';
import { rankH2hRound } from './ranking';
import { buildCsvRows, CsvInput, exportBlockers, toCsv } from './wcaCsv';

const attemptSelect = { value: true, penalty: true, status: true } as const;

/**
 * The WCA CSV of a head-to-head round (SPEC-001, WCA CSV export). Built on
 * the server: the scramble password comes with the request, decrypts the
 * scrambles for that request only, and is never stored or logged.
 */
@Injectable()
export class H2hExportService {
  constructor(
    private readonly prisma: DbService,
    @Inject(forwardRef(() => AppGateway))
    private readonly appGateway: AppGateway,
    private readonly h2hMatchService: H2hMatchService,
    private readonly wcaService: WcaService,
  ) {}

  /**
   * Fills the bracket's WCA round id from the WCA website when it is still
   * empty. A value already there, fetched or typed in by the delegate, is
   * kept. Null when there is none and the WCA can't give one.
   */
  async fillWcaRoundId(roundId: string): Promise<number | null> {
    const bracket = await this.prisma.h2hBracket.findUnique({
      where: { roundId },
      select: { id: true, eventId: true, wcaRoundId: true },
    });
    if (!bracket) return null;
    if (bracket.wcaRoundId !== null) return bracket.wcaRoundId;
    const competition = await this.prisma.competition.findFirst({
      select: { wcaId: true },
    });
    if (!competition) return null;
    const wcaRoundId = await this.wcaService.getLastRoundId(
      competition.wcaId,
      bracket.eventId,
    );
    if (wcaRoundId === null) return null;
    // Only while still empty: a value the delegate typed in meanwhile wins
    const { count } = await this.prisma.h2hBracket.updateMany({
      where: { id: bracket.id, wcaRoundId: null },
      data: { wcaRoundId },
    });
    if (count === 0) {
      const now = await this.prisma.h2hBracket.findUnique({
        where: { id: bracket.id },
        select: { wcaRoundId: true },
      });
      return now?.wcaRoundId ?? null;
    }
    this.appGateway.handleH2hUpdated(roundId);
    return wcaRoundId;
  }

  /** What blocks the export, so the screen lists it before the password */
  async getChecks(roundId: string) {
    await this.fillWcaRoundId(roundId);
    const { input, fileName } = await this.load(roundId);
    return {
      fileName,
      wcaRoundId: input.wcaRoundId,
      blockers: exportBlockers(input),
    };
  }

  /**
   * The CSV file. Refused, listing what to fix, while anything blocks it;
   * refused when the password doesn't decrypt the scrambles.
   */
  async exportCsv(roundId: string, password: string) {
    await this.fillWcaRoundId(roundId);
    const { input, fileName } = await this.load(roundId);
    const blockers = exportBlockers(input);
    if (blockers.length > 0) {
      throw new ConflictException({
        statusCode: HttpStatus.CONFLICT,
        error: 'Conflict',
        message: `Fix ${blockers.length === 1 ? 'this' : `these ${blockers.length} things`} before downloading the results`,
        blockers,
      });
    }
    // The rows carry the scrambles as stored; each is decrypted once here
    const rows = buildCsvRows(input);
    const plain = new Map<string, string>();
    for (const encrypted of new Set(rows.map((row) => row.scramble))) {
      const scramble = decryptScramble(encrypted, password);
      if (scramble === null) {
        throw new HttpException('Invalid password', HttpStatus.FORBIDDEN);
      }
      plain.set(encrypted, scramble);
    }
    const csv = toCsv(
      rows.map((row) => ({
        ...row,
        scramble: plain.get(row.scramble) ?? row.scramble,
      })),
    );
    return new StreamableFile(Buffer.from(csv, 'utf8'), {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="${fileName}"`,
    });
  }

  /** The bracket as the CSV reads it, with every scramble still encrypted */
  private async load(
    roundId: string,
  ): Promise<{ input: CsvInput; fileName: string }> {
    const [bracket, competition] = await Promise.all([
      this.prisma.h2hBracket.findUnique({
        where: { roundId },
        include: {
          entrants: {
            include: {
              person: {
                select: { id: true, name: true, wcaRegistrationId: true },
              },
            },
          },
          matches: {
            include: {
              sets: {
                include: {
                  points: {
                    include: {
                      attemptA: { select: attemptSelect },
                      attemptB: { select: attemptSelect },
                      scramble: {
                        select: {
                          num: true,
                          isExtra: true,
                          encryptedScramble: true,
                          scrambleSet: { select: { set: true } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.competition.findFirst({ select: { wcaId: true } }),
    ]);
    if (!bracket) throw new NotFoundException('This round has no bracket yet');
    if (!competition) throw new NotFoundException('Competition not found');

    const bestSingles = await this.h2hMatchService.bestSingles(
      this.prisma,
      roundId,
      bracket.entrants.map((entrant) => entrant.person.id),
    );
    const ranking = rankH2hRound(
      bracket.matches,
      bracket.entrants.map((entrant) => ({
        id: entrant.id,
        bestSingle: bestSingles.get(entrant.person.id) ?? null,
      })),
    );
    const positionOf = new Map(
      ranking.map((ranked) => [ranked.entrantId, ranked.position]),
    );
    const labels = matchLabels(bracket.matches);
    return {
      fileName: `${competition.wcaId}-${roundId}-h2h.csv`,
      input: {
        wcaRoundId: bracket.wcaRoundId,
        entrants: bracket.entrants.map((entrant) => ({
          id: entrant.id,
          name: entrant.person.name,
          registrationId: entrant.person.wcaRegistrationId,
          position: positionOf.get(entrant.id) ?? null,
        })),
        matches: bracket.matches.map((match) => ({
          matchNumber: match.matchNumber,
          label: labels.get(match.id) ?? `Match ${match.matchNumber}`,
          status: match.status,
          endedBy: match.endedBy,
          entrantAId: match.entrantAId,
          entrantBId: match.entrantBId,
          sets: match.sets.map((set) => ({
            setNumber: set.setNumber,
            hasScrambleSet: set.scrambleSetId !== null,
            points: set.points.map((point) => ({
              pointNumber: point.pointNumber,
              afterEnd: point.afterEnd,
              attemptA: point.attemptA,
              attemptB: point.attemptB,
              scramble: point.scramble && {
                set: point.scramble.scrambleSet.set,
                num: point.scramble.num,
                isExtra: point.scramble.isExtra,
                text: point.scramble.encryptedScramble,
              },
            })),
          })),
        })),
      },
    };
  }
}
