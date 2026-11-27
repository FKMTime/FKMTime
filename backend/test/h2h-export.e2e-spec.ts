import { INestApplication } from '@nestjs/common';
import * as CryptoJS from 'crypto-js';
import { DbService } from 'src/db/db.service';
import { WcaService } from 'src/wca/wca.service';
import * as request from 'supertest';
import { Competition } from 'wcif-helpers';

import { disconnectSeedDb, seedH2hBracket } from '../prisma/seed/seed-test';
import { Person, Prisma } from '../src/generated/prisma/client';
import { found } from '../src/test-utils/found';
import { createTestApp } from './helpers/app.helper';
import {
  createRoleUsers,
  deleteSetupUsers,
  TestUser,
} from './helpers/setup-roles.helper';

const SUFFIX = 'h2h-export';
const PASSWORD = 'scramble-password';

/** An invented scramble per set and number, as TNoodle words them */
const scrambleText = (set: string, name: string) => `R U F' D2 L ${set}${name}`;

interface AttemptView {
  id: string;
  attemptNumber: number;
  value: number;
  penalty: number;
}

interface View {
  bracket: {
    wcaRoundId: number | null;
    status: string;
    entrants: {
      id: string;
      person: { id: string };
      position: number | null;
      bestSingle: number | null;
    }[];
    matches: {
      id: string;
      matchNumber: number;
      label: string;
      status: string;
      sideA: { entrantId: string | null };
      sideB: { entrantId: string | null };
      sets: {
        setNumber: number;
        scrambleSet: { id: string; set: string } | null;
        points: {
          id: string;
          pointNumber: number;
          attemptA: AttemptView | null;
          attemptB: AttemptView | null;
          scramble: { set: string; num: number; isExtra: boolean } | null;
        }[];
      }[];
    }[];
  };
}

interface Checks {
  fileName: string;
  wcaRoundId: number | null;
  blockers: string[];
}

/** The rows of a CSV with a header, by column name */
const parseCsv = (csv: string) => {
  const [header, ...lines] = csv.trimEnd().split('\n');
  const columns = header.split(',');
  return lines.map((line) => {
    const cells = line.split(',');
    return Object.fromEntries(columns.map((c, i) => [c, cells[i]]));
  });
};

describe('Head-to-head WCA CSV export (e2e)', () => {
  let app: INestApplication;
  let db: DbService;
  let users: Record<
    'DELEGATE' | 'ORGANIZER' | 'STAGE_LEADER' | 'STAFF',
    TestUser
  >;
  let originalWcif: Prisma.JsonValue;
  let wcaId: string;
  let roundId: string;
  let eventId: string;
  /** Four people registered for the event: seeds 1 to 4 */
  let seeds: Person[];

  const server = () => app.getHttpServer();
  const as = (user: TestUser) => ({
    Authorization: `Bearer ${user.token}`,
  });
  const getView = async () =>
    (
      await request(server())
        .get(`/h2h/${roundId}`)
        .set(as(users.STAFF))
        .expect(200)
    ).body as View;
  const matchOf = (view: View, matchNumber: number) =>
    found(
      view.bracket.matches.find((m) => m.matchNumber === matchNumber),
      `match ${matchNumber}`,
    );
  const personOf = (view: View, entrantId: string | null) =>
    found(
      view.bracket.entrants.find((e) => e.id === entrantId),
      'entrant',
    ).person.id;
  const getChecks = async (user = users.DELEGATE) =>
    (
      await request(server())
        .get(`/h2h/${roundId}/export/checks`)
        .set(as(user))
        .expect(200)
    ).body as Checks;
  const exportCsv = (password = PASSWORD, user = users.DELEGATE) =>
    request(server())
      .post(`/h2h/${roundId}/export`)
      .set(as(user))
      .send({ password });
  /** What the dummy WCA says the event's last round is */
  const dummyRoundId = async () => {
    const response = await fetch(
      `${process.env.WCA_ORIGIN}/api/v0/competitions/${wcaId}/results/${eventId}`,
    );
    expect(response.ok).toBe(true);
    const data = (await response.json()) as { rounds: { id: number }[] };
    return data.rounds[0].id;
  };
  const start = (matchId: string) =>
    request(server())
      .post(`/h2h/match/${matchId}/start`)
      .set(as(users.STAGE_LEADER))
      .expect(200);
  /** Manual entry; the attempt number given is ignored for these rounds */
  const enter = (personId: string, value: number, penalty = 0) =>
    request(server())
      .post('/attempt')
      .set(as(users.DELEGATE))
      .send({
        attemptNumber: 99,
        value,
        penalty,
        roundId,
        competitorId: personId,
        status: 'STANDARD',
        type: 'STANDARD_ATTEMPT',
      })
      .expect(201);
  /** Both sides of a match: A and B's person ids */
  const sides = async (matchNumber: number) => {
    const view = await getView();
    const match = matchOf(view, matchNumber);
    return {
      id: match.id,
      label: match.label,
      a: personOf(view, match.sideA.entrantId),
      b: personOf(view, match.sideB.entrantId),
    };
  };
  const point = async (a: string, b: string, timeA = 900, timeB = 1000) => {
    await enter(a, timeA);
    await enter(b, timeB);
  };
  /** Plays a match to 3 points for A in one set */
  const winForA = async (matchNumber: number) => {
    const match = await sides(matchNumber);
    await start(match.id);
    for (let i = 0; i < 3; i++) await point(match.a, match.b);
    return match;
  };
  const clearWcaRoundId = () =>
    request(server())
      .put(`/h2h/${roundId}`)
      .set(as(users.DELEGATE))
      .send({ wcaRoundId: null })
      .expect(200);

  /**
   * Creating a bracket fetches its WCA round id in the background: waits
   * for it, so it can't land in the middle of a test
   */
  const waitForWcaRoundId = async () => {
    for (let i = 0; i < 50; i++) {
      const { wcaRoundId } = (await getView()).bracket;
      if (wcaRoundId !== null) return wcaRoundId;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return null;
  };

  /** A fresh 4-competitor bracket, one set to win, sets A to E to race on */
  const setUpBracket = async () => {
    await request(server())
      .post(`/h2h/${roundId}`)
      .set(as(users.DELEGATE))
      .send({ size: 4 })
      .expect(201);
    expect(await waitForWcaRoundId()).not.toBeNull();
    await request(server())
      .put(`/h2h/${roundId}/seeds`)
      .set(as(users.DELEGATE))
      .send({ personIds: seeds.map((p) => p.id) })
      .expect(200);
    await request(server())
      .post('/scramble-set/import')
      .set(as(users.DELEGATE))
      .send({
        scrambleSets: ['A', 'B', 'C', 'D', 'E'].map((set) => ({
          roundId,
          set,
          scrambles: [
            ...[1, 2, 3, 4, 5].map((num) => ({
              num,
              isExtra: false,
              encryptedScramble: CryptoJS.AES.encrypt(
                scrambleText(set, String(num)),
                PASSWORD,
              ).toString(),
            })),
            ...[1, 2].map((num) => ({
              num,
              isExtra: true,
              encryptedScramble: CryptoJS.AES.encrypt(
                scrambleText(set, `e${num}`),
                PASSWORD,
              ).toString(),
            })),
          ],
        })),
      })
      .expect(201);
  };

  const clean = async () => {
    // Points hold their attempts and scrambles, so the bracket goes first
    await db.h2hBracket.deleteMany();
    await db.result.deleteMany({ where: { roundId } });
    await db.scrambleSet.deleteMany({ where: { roundId } });
  };

  beforeAll(async () => {
    ({ app, db } = await createTestApp());
    await deleteSetupUsers(db, SUFFIX);
    users = await createRoleUsers(app, db, SUFFIX);
    const competition = found(
      await db.competition.findFirst(),
      'seeded competition',
    );
    originalWcif = competition.wcif;
    wcaId = competition.wcaId;
    const wcif = competition.wcif as unknown as Competition;
    const round = found(
      wcif.events.flatMap((e) => e.rounds).find((r) => r.format === 'h'),
      'a head-to-head round in the dummy WCA competition',
    );
    roundId = round.id;
    eventId = roundId.split('-r')[0];
    const registrantIds = wcif.persons
      .filter(
        (p) =>
          p.registration?.status === 'accepted' &&
          p.registration.eventIds.includes(eventId as never),
      )
      .map((p) => p.registrantId);
    seeds = (
      await db.person.findMany({
        where: { registrantId: { in: registrantIds } },
        orderBy: { registrantId: 'asc' },
      })
    ).slice(0, 4);
    expect(seeds).toHaveLength(4);
    expect(seeds.every((p) => p.wcaRegistrationId !== null)).toBe(true);
  }, 30000);

  beforeEach(async () => {
    await clean();
    await setUpBracket();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    // A test that cleared one puts it back
    for (const person of seeds) {
      await db.person.update({
        where: { id: person.id },
        data: { wcaRegistrationId: person.wcaRegistrationId },
      });
    }
  });

  afterAll(async () => {
    await clean();
    // Leave the bracket the seed gives, for whatever runs next
    await seedH2hBracket(originalWcif as unknown as Competition);
    await disconnectSeedDb();
    await deleteSetupUsers(db, SUFFIX);
    await app.close();
  }, 30000);

  it('fetches the WCA round id from the WCA website when it is empty', async () => {
    const expected = await dummyRoundId();
    // Creating the bracket fetched it already, in the background
    expect(await waitForWcaRoundId()).toBe(expected);
    await clearWcaRoundId();
    expect((await getView()).bracket.wcaRoundId).toBeNull();

    const checks = await getChecks();

    expect(checks.wcaRoundId).toBe(expected);
    expect((await getView()).bracket.wcaRoundId).toBe(expected);
    expect(checks.fileName).toBe(`${wcaId}-${roundId}-h2h.csv`);
  });

  it('creates the bracket without waiting for the WCA, which may be out of reach', async () => {
    await clean();
    // The WCA answers only after the test's time is up, as an unreachable
    // one does after its timeout: creating must not wait for it
    jest
      .spyOn(app.get(WcaService), 'getWcaRoundId')
      .mockReturnValue(
        new Promise((resolve) => setTimeout(() => resolve(null), 8000)),
      );

    await request(server())
      .post(`/h2h/${roundId}`)
      .set(as(users.DELEGATE))
      .send({ size: 4 })
      .expect(201);
  }, 5000);

  it('keeps a WCA round id the delegate entered', async () => {
    await request(server())
      .put(`/h2h/${roundId}`)
      .set(as(users.DELEGATE))
      .send({ wcaRoundId: 4321 })
      .expect(200);

    expect((await getChecks()).wcaRoundId).toBe(4321);
  });

  it('is for delegates and organisers only', async () => {
    await request(server())
      .get(`/h2h/${roundId}/export/checks`)
      .set(as(users.STAFF))
      .expect(403);
    await exportCsv(PASSWORD, users.STAGE_LEADER).expect(403);
    await getChecks(users.ORGANIZER);
  });

  it('lists every blocking check, and gives no file while any apply', async () => {
    const semi1 = await sides(1);
    const semi2 = await sides(2);
    await start(semi1.id);
    await point(semi1.a, semi1.b);
    // Point 2 waits for B
    await enter(semi1.a, 950);
    await start(semi2.id);
    await point(semi2.a, semi2.b);
    // An incident on semifinal 2's first point, still open
    const view = await getView();
    const incident = found(
      matchOf(view, 2).sets[0].points[0].attemptA,
      'attempt',
    );
    await request(server())
      .put(`/attempt/${incident.id}`)
      .set(as(users.DELEGATE))
      .send({
        attemptNumber: incident.attemptNumber,
        value: incident.value,
        penalty: 0,
        status: 'UNRESOLVED',
        type: 'STANDARD_ATTEMPT',
      })
      .expect(200);
    // What only a broken import or a bad sync leaves behind
    const set1 = found(
      await db.h2hSet.findFirst({
        where: { matchId: semi1.id, setNumber: 1 },
        include: { points: { orderBy: { pointNumber: 'asc' } } },
      }),
      'set 1 of semifinal 1',
    );
    await db.h2hPoint.update({
      where: { id: set1.points[0].id },
      data: { scrambleId: null },
    });
    await db.h2hSet.update({
      where: { id: set1.id },
      data: { scrambleSetId: null },
    });
    const unregistered = found(
      seeds.find((p) => p.id === semi1.b),
      'competitor',
    );
    await db.person.update({
      where: { id: unregistered.id },
      data: { wcaRegistrationId: null },
    });
    await clearWcaRoundId();
    jest.spyOn(app.get(WcaService), 'getWcaRoundId').mockResolvedValue(null);

    const checks = await getChecks();

    const labels = (await getView()).bracket.matches.map((m) => m.label);
    expect(checks.blockers).toEqual([
      ...labels.map((label) => `${label} isn't finished`),
      "The WCA round id couldn't be fetched from the WCA website. Enter it on the Bracket tab.",
      `${semi1.label}, set 1 has no scramble set`,
      `${semi1.label}, set 1, point 1 has no scramble`,
      `${semi1.label}, set 1, point 2 has only one result. Enter the missing one.`,
      `${semi2.label}, set 1, point 1 has an open incident. Resolve it first.`,
      `${unregistered.name} has no WCA registration id. Only competitors registered on the WCA website can be in the results: sync the competition, or check the registration.`,
    ]);
    const refused = await exportCsv().expect(409);
    expect(refused.headers['content-type']).toMatch(/json/);
    expect(refused.headers['content-disposition']).toBeUndefined();
    expect(refused.body.blockers).toEqual(checks.blockers);
  });

  describe('a finished bracket', () => {
    /**
     * Semifinal 1 with a DNF, a DNS, a +2, a time over a minute and an
     * extra on point 3; the other matches 3-0 to side A
     */
    const playBracket = async () => {
      const semi1 = await sides(1);
      await start(semi1.id);
      await point(semi1.a, semi1.b, 900, 1000);
      // A DNF against 65.32: B's point
      await enter(semi1.a, 1500, -1);
      await enter(semi1.b, 6532);
      await point(semi1.a, semi1.b, 1020, 1100);
      const raced = matchOf(await getView(), 1).sets[0].points[2];
      await request(server())
        .post(`/h2h/point/${raced.id}/extra`)
        .set(as(users.DELEGATE))
        .send({ comment: 'The scramble was wrong' })
        .expect(200);
      // The re-race, then 58.00 with a +2 against a DNS
      await point(semi1.a, semi1.b, 1200, 1300);
      await enter(semi1.a, 5800, 2);
      await enter(semi1.b, 0, -2);
      await winForA(2);
      await winForA(3);
      await winForA(4);
      return semi1;
    };

    it('downloads the CSV the WCA website imports', async () => {
      await clearWcaRoundId();
      const semi1 = await playBracket();
      const view = await getView();
      expect(view.bracket.status).toBe('FINISHED');
      expect((await getChecks()).blockers).toEqual([]);

      const res = await exportCsv().expect(200);

      expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(res.headers['content-disposition']).toBe(
        `attachment; filename="${wcaId}-${roundId}-h2h.csv"`,
      );
      expect(res.text.split('\n')[0]).toBe(
        'round_id,match_number,match_set_number,set_attempt_number,registration_id,final_position,time_seconds,scramble,scramble_set_number,scramble_number,is_extra',
      );
      const rows = parseCsv(res.text);
      // 4 points in semifinal 1, 3 in each other match, two rows a point
      expect(rows).toHaveLength(26);
      const wcaRoundId = String(await dummyRoundId());
      expect(rows.every((row) => row.round_id === wcaRoundId)).toBe(true);
      expect(
        rows.map((row) => `${row.match_number}/${row.match_set_number}`),
      ).toEqual([
        ...Array(8).fill('1/1'),
        ...Array(6).fill('2/1'),
        ...Array(6).fill('3/1'),
        ...Array(6).fill('4/1'),
      ]);

      const registrationOf = (personId: string) =>
        String(found(seeds.find((p) => p.id === personId)).wcaRegistrationId);
      const semi = rows.slice(0, 8);
      expect(
        semi.map((row) => [
          row.set_attempt_number,
          row.registration_id,
          row.time_seconds,
        ]),
      ).toEqual([
        ['1', registrationOf(semi1.a), '9.00'],
        ['1', registrationOf(semi1.b), '10.00'],
        ['2', registrationOf(semi1.a), '-1'],
        ['2', registrationOf(semi1.b), '65.32'],
        // Only the re-race: 10.20 and 11.00 were replaced by the extra
        ['3', registrationOf(semi1.a), '12.00'],
        ['3', registrationOf(semi1.b), '13.00'],
        ['4', registrationOf(semi1.a), '60.00'],
        ['4', registrationOf(semi1.b), '-2'],
      ]);
      const letter = found(matchOf(view, 1).sets[0].scrambleSet).set;
      const setNumber = String(letter.charCodeAt(0) - 64);
      expect(
        semi.map((row) => [
          row.scramble,
          row.scramble_set_number,
          row.scramble_number,
          row.is_extra,
        ]),
      ).toEqual([
        [scrambleText(letter, '1'), setNumber, '1', '0'],
        [scrambleText(letter, '1'), setNumber, '1', '0'],
        [scrambleText(letter, '2'), setNumber, '2', '0'],
        [scrambleText(letter, '2'), setNumber, '2', '0'],
        [scrambleText(letter, 'e1'), setNumber, '1', '1'],
        [scrambleText(letter, 'e1'), setNumber, '1', '1'],
        [scrambleText(letter, '4'), setNumber, '4', '0'],
        [scrambleText(letter, '4'), setNumber, '4', '0'],
      ]);

      // The final and the third-place match give positions 1 to 4
      const positionOf = (personId: string) =>
        found(view.bracket.entrants.find((e) => e.person.id === personId))
          .position;
      for (const row of rows) {
        const person = found(
          seeds.find(
            (p) => String(p.wcaRegistrationId) === row.registration_id,
          ),
        );
        expect(row.final_position).toBe(String(positionOf(person.id)));
      }
      expect(new Set(rows.map((row) => row.final_position))).toEqual(
        new Set(['1', '2', '3', '4']),
      );
    });

    it("leaves points raced after a set's end out of the file and of the best single", async () => {
      // A, A, B, A: then B's point 3 becomes a DNF, so reopening ends the
      // set at point 3, and point 4, A's best single, comes after the end
      const semi1 = await sides(1);
      await start(semi1.id);
      await point(semi1.a, semi1.b, 900, 1000);
      await point(semi1.a, semi1.b, 900, 1000);
      await point(semi1.a, semi1.b, 1100, 1000);
      await point(semi1.a, semi1.b, 500, 1000);
      const third = found(
        matchOf(await getView(), 1).sets[0].points[2].attemptB,
        'attempt',
      );
      await request(server())
        .put(`/attempt/${third.id}`)
        .set(as(users.DELEGATE))
        .send({
          attemptNumber: third.attemptNumber,
          value: third.value,
          penalty: -1,
          status: 'STANDARD',
          type: 'STANDARD_ATTEMPT',
        })
        .expect(200);
      await request(server())
        .post(`/h2h/match/${semi1.id}/reopen`)
        .set(as(users.DELEGATE))
        .send({ comment: 'The time was typed wrong' })
        .expect(200);
      expect(
        await db.h2hPoint.count({
          where: { set: { matchId: semi1.id }, afterEnd: true },
        }),
      ).toBe(1);
      await winForA(2);
      await winForA(3);
      await winForA(4);

      const rows = parseCsv((await exportCsv().expect(200)).text);

      expect(
        rows
          .filter((row) => row.match_number === '1')
          .map((row) => [row.set_attempt_number, row.time_seconds]),
      ).toEqual([
        ['1', '9.00'],
        ['1', '10.00'],
        ['2', '9.00'],
        ['2', '10.00'],
        ['3', '11.00'],
        ['3', '-1'],
      ]);
      // A's 5.00 on point 4 counts for nothing: neither in the file nor in
      // the ranking, which the WCA's best and pos would contradict
      // The WCA takes best from the rows and pos as given: the ranking's
      // best single must be the best of the rows (A's is 9.00)
      const view = await getView();
      expect(
        found(
          view.bracket.entrants.find((e) => e.person.id === semi1.a),
          'entrant A',
        ).bestSingle,
      ).toBe(900);
      for (const entrant of view.bracket.entrants) {
        const person = found(seeds.find((p) => p.id === entrant.person.id));
        const solved = rows
          .filter(
            (row) => row.registration_id === String(person.wcaRegistrationId),
          )
          .map((row) => Number(row.time_seconds.replace('.', '')))
          .filter((value) => value > 0);
        expect(Math.min(...solved)).toBe(entrant.bestSingle);
      }
    });

    it('refuses a wrong password', async () => {
      await playBracket();

      const res = await exportCsv('not-the-password').expect(403);

      expect(res.body.message).toBe('Invalid password');
      await exportCsv('').expect(400);
    });
  });
});
