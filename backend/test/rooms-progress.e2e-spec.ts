import { INestApplication } from '@nestjs/common';
import { DNF_VALUE } from 'src/constants';
import { DbService } from 'src/db/db.service';
import * as request from 'supertest';

import {
  AttemptStatus,
  AttemptType,
  Competition,
  Prisma,
  Role,
  Room,
  StaffActivityStatus,
  StaffRole,
} from '../src/generated/prisma/client';
import { found } from '../src/test-utils/found';
import { createTestApp } from './helpers/app.helper';
import { listenOnLoopback } from './helpers/loopback.helper';
import {
  createUserWithRoles,
  deleteSetupUsers,
  TestUser,
} from './helpers/setup-roles.helper';

const SUFFIX = 'rooms-progress';
const ROUND_IDS = ['333-r2', '444-r1', '222-r1'];
const WALK_IN_NAME = 'Rooms Progress Walk-in';
// How often the periodic group check runs, and how long a group has to be
// quiet before it lets no-shows go (competition.service / groupChange)
const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const QUIET_MS = 5 * 60 * 1000;

interface WcifActivity {
  id: number;
  activityCode: string;
  childActivities?: WcifActivity[];
}
interface WcifLike {
  persons: {
    registrantId: number;
    assignments?: { activityId: number; assignmentCode: string }[];
  }[];
  schedule: { venues: { rooms: { activities: WcifActivity[] }[] }[] };
}

/** Registrant ids assigned to compete in a group, in WCIF order */
const competitorsOfGroup = (wcif: WcifLike, groupId: string) => {
  const ids = new Set<number>();
  const visit = (a: WcifActivity) => {
    if (a.activityCode === groupId) ids.add(a.id);
    a.childActivities?.forEach(visit);
  };
  wcif.schedule.venues.forEach((v) =>
    v.rooms.forEach((r) => r.activities.forEach(visit)),
  );
  return wcif.persons
    .filter((p) =>
      (p.assignments ?? []).some(
        (a) => a.assignmentCode === 'competitor' && ids.has(a.activityId),
      ),
    )
    .map((p) => p.registrantId);
};

type AttemptInput = Omit<Prisma.AttemptCreateManyInput, 'resultId'>;

/** Plain solved attempts numbered from 1, one per value */
const solves = (...values: number[]): AttemptInput[] =>
  values.map((value, i) => ({ attemptNumber: i + 1, value }));

/**
 * Pins what GET /competition/rooms/progress returns for a competition in
 * full swing: several rooms, several groups per room, a cutoff round,
 * incidents, extras (fresh-set redo too), a no-show, a competitor moved to
 * another group, someone added on site, and results removed under
 * Regulation 9t. Every value is spelled out so a change in how the progress
 * is computed can't change what the panel shows.
 */
describe('GET /competition/rooms/progress (e2e)', () => {
  let app: INestApplication;
  let db: DbService;
  let organizer: TestUser;
  let competition: Competition;
  let mainHall: Room;
  let sideHall: Room;
  let wcif: WcifLike;
  let movedRowId: string;
  let noShowRowId: string;

  const server = () => app.getHttpServer();
  const progress = () =>
    request(server())
      .get('/competition/rooms/progress')
      .set('Authorization', `Bearer ${organizer.token}`)
      .expect(200);

  const personOf = async (registrantId: number) =>
    found(
      await db.person.findUnique({ where: { registrantId } }),
      `person ${registrantId}`,
    );

  const addResult = async (
    personId: string,
    roundId: string,
    attempts: AttemptInput[],
    extra: Partial<Prisma.ResultUncheckedCreateInput> = {},
  ) => {
    const result = await db.result.create({
      data: { personId, roundId, eventId: roundId.split('-')[0], ...extra },
    });
    if (attempts.length > 0) {
      await db.attempt.createMany({
        data: attempts.map((a) => ({ ...a, resultId: result.id })),
      });
    }
    return result;
  };

  /** What the panel shows for someone the group waits for */
  const waitingFor = async (registrantId: number) => {
    const person = await personOf(registrantId);
    return { personId: person.id, name: person.name };
  };

  const clearRounds = async () => {
    await db.result.deleteMany({
      where: { roundId: { in: ROUND_IDS }, removedAt: undefined },
    });
    await db.person.deleteMany({ where: { name: WALK_IN_NAME } });
  };

  beforeAll(async () => {
    ({ app, db } = await createTestApp());
    await listenOnLoopback(app);
    await deleteSetupUsers(db, SUFFIX);
    organizer = await createUserWithRoles(app, db, `organizer-${SUFFIX}`, [
      Role.ORGANIZER,
    ]);
    competition = found(await db.competition.findFirst(), 'competition');
    wcif = competition.wcif as unknown as WcifLike;
    mainHall = found(
      await db.room.findFirst({ where: { name: 'Main Hall' } }),
      'Main Hall',
    );
    sideHall = found(
      await db.room.findFirst({ where: { name: 'Side Hall' } }),
      'Side Hall',
    );
    await clearRounds();
  }, 30000);

  afterAll(async () => {
    await clearRounds();
    if (movedRowId) {
      await db.staffActivity.update({
        where: { id: movedRowId },
        data: { groupId: '333-r2-g2' },
      });
    }
    if (noShowRowId) {
      await db.staffActivity.update({
        where: { id: noShowRowId },
        data: { noShow: false },
      });
    }
    await db.competition.update({
      where: { id: competition.id },
      data: {
        useFkmTimeDevices: competition.useFkmTimeDevices,
        shouldChangeGroupsAutomatically:
          competition.shouldChangeGroupsAutomatically,
      },
    });
    await db.room.update({
      where: { id: mainHall.id },
      data: { currentGroupIds: mainHall.currentGroupIds },
    });
    await db.room.update({
      where: { id: sideHall.id },
      data: { currentGroupIds: sideHall.currentGroupIds },
    });
    await deleteSetupUsers(db, SUFFIX);
    await app.close();
  }, 30000);

  it('reports every running group as it stands', async () => {
    // Automatic group changes on, so a group waiting only for competitors
    // who haven't started says when it moves on. No group here is finished
    // or quiet, so the periodic check leaves the rooms alone meanwhile.
    await db.competition.update({
      where: { id: competition.id },
      data: { useFkmTimeDevices: true, shouldChangeGroupsAutomatically: true },
    });
    await db.room.update({
      where: { id: mainHall.id },
      data: { currentGroupIds: ['333-r2-g5', '444-r1-g1', '222-r1-g1'] },
    });
    await db.room.update({
      where: { id: sideHall.id },
      data: { currentGroupIds: ['333-r2-g2'] },
    });

    // --- Side Hall, 333-r2-g2: the room has later groups of the round ----
    const side = competitorsOfGroup(wcif, '333-r2-g2');
    expect(side).toHaveLength(6);
    const [s0, s1, s2, s3, s4, s5] = side;
    // s0: five in, but the second was given an extra on a fresh set that
    // hasn't started: done for this group, the redo can wait
    const s0Person = await personOf(s0);
    const s0Result = await addResult(s0Person.id, '333-r2', []);
    const grant = await db.extraGrant.create({
      data: { resultId: s0Result.id, useFreshSet: true },
    });
    await db.attempt.createMany({
      data: solves(1000, 1100, 1200, 1300, 1400).map((a) => ({
        ...a,
        resultId: s0Result.id,
        ...(a.attemptNumber === 2
          ? { status: AttemptStatus.EXTRA_GIVEN, extraGrantId: grant.id }
          : {}),
      })),
    });
    // s1: three in, the fourth an incident to resolve
    await addResult((await personOf(s1)).id, '333-r2', [
      ...solves(1000, 1100, 1200),
      { attemptNumber: 4, value: 1300, status: AttemptStatus.UNRESOLVED },
    ]);
    // s2: removed under Regulation 9t, all five attempts in
    await addResult(
      (await personOf(s2)).id,
      '333-r2',
      solves(1000, 1100, 1200, 1300, 1400),
      { removedAt: new Date(), removedReason: 'Regulation 9t' },
    );
    // s3: absent and marked as not coming
    const s3Row = found(
      await db.staffActivity.findFirst({
        where: {
          person: { registrantId: s3 },
          groupId: '333-r2-g2',
          role: StaffRole.COMPETITOR,
        },
      }),
      's3 row',
    );
    noShowRowId = s3Row.id;
    await db.staffActivity.update({
      where: { id: s3Row.id },
      data: { noShow: true, status: StaffActivityStatus.ABSENT },
    });
    // s4: moved to a later group on the competitor page; the stored WCIF
    // still has them here
    const s4Row = found(
      await db.staffActivity.findFirst({
        where: {
          person: { registrantId: s4 },
          groupId: '333-r2-g2',
          role: StaffRole.COMPETITOR,
        },
      }),
      's4 row',
    );
    movedRowId = s4Row.id;
    await db.staffActivity.update({
      where: { id: s4Row.id },
      data: { groupId: '333-r2-g4' },
    });
    // s5: hasn't started
    // Someone added on site, marked present, two attempts in
    const walkIn = await db.person.create({
      data: { name: WALK_IN_NAME, canCompete: true },
    });
    await db.staffActivity.create({
      data: {
        personId: walkIn.id,
        groupId: '333-r2-g2',
        role: StaffRole.COMPETITOR,
        status: StaffActivityStatus.PRESENT,
      },
    });
    await addResult(walkIn.id, '333-r2', solves(1500, 1600));

    // --- Main Hall, 333-r2-g5: the room's last group of the round --------
    const last = competitorsOfGroup(wcif, '333-r2-g5');
    expect(last).toHaveLength(6);
    const [m0, m1, m2, m3, m4, m5] = last;
    await addResult(
      (await personOf(m0)).id,
      '333-r2',
      solves(900, 950, 1000, 1050, 1100),
    );
    // m1: two in, a scramble in hand for the third
    await addResult((await personOf(m1)).id, '333-r2', [
      ...solves(1000, 1100),
      { attemptNumber: 3, value: 0, status: AttemptStatus.SCRAMBLED },
    ]);
    // m2: removed under Regulation 9t while solving
    await addResult(
      (await personOf(m2)).id,
      '333-r2',
      [{ attemptNumber: 1, value: 0, status: AttemptStatus.SCRAMBLED }],
      { removedAt: new Date(), removedReason: 'Regulation 9t' },
    );
    // From an earlier group in the room: an extra still to do holds the
    // room's last group back
    const [earlier] = competitorsOfGroup(wcif, '333-r2-g1');
    await addResult((await personOf(earlier)).id, '333-r2', [
      ...solves(1000, 1100),
      { attemptNumber: 3, value: 1200, status: AttemptStatus.EXTRA_GIVEN },
      ...solves(1300, 1400).map((a) => ({
        ...a,
        attemptNumber: a.attemptNumber + 3,
      })),
    ]);

    // --- Main Hall, 444-r1-g1: cutoff of two attempts under 2:00.00 ------
    const cutoffGroup = competitorsOfGroup(wcif, '444-r1-g1');
    expect(cutoffGroup).toHaveLength(7);
    const [q0, q1, q2, q3, q4, q5, q6] = cutoffGroup;
    // q0: missed the cutoff, done after two
    await addResult((await personOf(q0)).id, '444-r1', solves(13000, 14000));
    // q1: one in, under the cutoff: may still do five
    await addResult((await personOf(q1)).id, '444-r1', solves(9000));
    // q2: made the cutoff on the first, three of five in
    await addResult(
      (await personOf(q2)).id,
      '444-r1',
      solves(9000, 13000, 10000),
    );
    // q3: a DNF and a time over the cutoff, done after two
    await addResult((await personOf(q3)).id, '444-r1', [
      { attemptNumber: 1, value: 0, penalty: DNF_VALUE },
      { attemptNumber: 2, value: 15000 },
    ]);
    // An extra that replaced the second attempt counts in its place
    await db.attempt.updateMany({
      where: {
        result: { person: { registrantId: q3 }, roundId: '444-r1' },
        attemptNumber: 2,
      },
      data: { status: AttemptStatus.EXTRA_GIVEN, replacedBy: 1 },
    });
    const q3Result = found(
      await db.result.findFirst({
        where: { person: { registrantId: q3 }, roundId: '444-r1' },
      }),
      'q3 result',
    );
    await db.attempt.create({
      data: {
        resultId: q3Result.id,
        attemptNumber: 1,
        type: AttemptType.EXTRA_ATTEMPT,
        value: 16000,
      },
    });

    // --- Main Hall, 222-r1-g1: one done, everyone else not started -------
    const waiting = competitorsOfGroup(wcif, '222-r1-g1');
    expect(waiting).toHaveLength(7);
    const [w0, ...wRest] = waiting;
    // Solved in the future, so the group can't look quiet during the test
    const solvedAt = new Date(Date.now() + 60 * 60 * 1000);
    await addResult(
      (await personOf(w0)).id,
      '222-r1',
      solves(300, 310, 320, 330, 340).map((a) => ({ ...a, solvedAt })),
    );
    const movesOnAt = new Date(
      Math.ceil((solvedAt.getTime() + QUIET_MS) / CHECK_INTERVAL_MS) *
        CHECK_INTERVAL_MS,
    ).toISOString();

    const res = await progress();

    const byRoom = (roomId: string) =>
      res.body.find((r: { roomId: string }) => r.roomId === roomId);
    expect(res.body).toHaveLength(2);
    expect(byRoom(sideHall.id)).toEqual({
      roomId: sideHall.id,
      groups: [
        {
          groupId: '333-r2-g2',
          roundId: '333-r2',
          competitors: 6,
          finished: 0,
          // s0: four counting (the second waits for its extra), s1: three
          entered: 7,
          expected: 30,
          expectedIsFinal: true,
          wait: {
            state: 'inProgress',
            notStarted: [await waitingFor(s5)],
            // The walk-in
            solving: 1,
            incidents: 1,
            extras: 0,
            movesOnAt: null,
          },
        },
      ],
    });
    expect(byRoom(mainHall.id)).toEqual({
      roomId: mainHall.id,
      groups: [
        {
          groupId: '333-r2-g5',
          roundId: '333-r2',
          competitors: 6,
          finished: 1,
          entered: 7,
          expected: 30,
          expectedIsFinal: true,
          wait: {
            state: 'inProgress',
            notStarted: [
              await waitingFor(m3),
              await waitingFor(m4),
              await waitingFor(m5),
            ],
            solving: 1,
            incidents: 0,
            extras: 1,
            movesOnAt: null,
          },
        },
        {
          groupId: '444-r1-g1',
          roundId: '444-r1',
          competitors: 7,
          finished: 2,
          entered: 8,
          // q0 and q3 two each, everyone else five
          expected: 29,
          expectedIsFinal: false,
          wait: {
            state: 'inProgress',
            notStarted: [
              await waitingFor(q4),
              await waitingFor(q5),
              await waitingFor(q6),
            ],
            solving: 2,
            incidents: 0,
            extras: 0,
            movesOnAt: null,
          },
        },
        {
          groupId: '222-r1-g1',
          roundId: '222-r1',
          competitors: 7,
          finished: 1,
          entered: 5,
          expected: 35,
          expectedIsFinal: true,
          wait: {
            state: 'waitingForCompetitors',
            notStarted: await Promise.all(wRest.map(waitingFor)),
            solving: 0,
            incidents: 0,
            extras: 0,
            movesOnAt,
          },
        },
      ],
    });
  });
});
