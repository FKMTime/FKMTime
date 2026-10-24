import { INestApplication } from '@nestjs/common';
import {
  Competition,
  Person,
  Prisma,
  QuickAction,
  Role,
  Room,
  StaffActivity,
  UnofficialEvent,
  User,
} from '@prisma/client';
import { DbService } from 'src/db/db.service';
import * as request from 'supertest';

import { createTestApp } from './helpers/app.helper';
import { listenOnLoopback } from './helpers/loopback.helper';

/** A competition the dummy WCA serves a v2 WCIF for */
const IMPORTED_WCA_ID = 'CubeFactoryLeagueZgierz2026';
/** Dummy WCA user who is a delegate of IMPORTED_WCA_ID */
const DELEGATE_CODE = 'code-2013ROGA02';
/** Dummy WCA user who neither organizes nor delegates IMPORTED_WCA_ID */
const OUTSIDER_CODE = 'code-2013KOSK01';
const REDIRECT_URI = 'http://localhost:5173/auth/login';

interface WcifPerson {
  registrantId: number;
  name: string;
  registration?: { status: string };
  assignments: unknown[];
}
interface Wcif {
  id: string;
  name: string;
  countryIso2: string;
  persons: WcifPerson[];
  events: { id: string }[];
  schedule: { venues: { rooms: { name: string }[] }[] };
}

interface Snapshot {
  competitions: Competition[];
  users: User[];
  quickActions: QuickAction[];
  persons: Person[];
  staffActivities: StaffActivity[];
  rooms: Room[];
  unofficialEvents: UnofficialEvent[];
}

/**
 * Import and sync replace the whole competition, its persons and most users,
 * so this spec snapshots that state first and puts it back afterwards.
 */
describe('Competition import & sync from WCA (e2e)', () => {
  let app: INestApplication;
  let db: DbService;
  let adminToken: string;
  let snapshot: Snapshot;
  let wcif: Wcif;

  const server = () => app.getHttpServer();
  const acceptedPersons = () =>
    wcif.persons.filter(
      (p) => p.registrantId && p.registration?.status === 'accepted',
    );
  const loginWithWca = async (code: string) => {
    const res = await request(server())
      .post('/auth/wca/login')
      .send({ code, redirectUri: REDIRECT_URI })
      .expect(200);
    return res.body as {
      token: string;
      userInfo: { id: string; roles: Role[] };
    };
  };
  const clearCompetition = async () => {
    await db.competition.deleteMany();
    await db.person.deleteMany();
  };

  const restoreSnapshot = async () => {
    await db.competition.deleteMany();
    await db.person.deleteMany();
    await db.unofficialEvent.deleteMany();
    await db.room.deleteMany({
      where: { id: { notIn: snapshot.rooms.map((r) => r.id) } },
    });
    await db.user.deleteMany({
      where: { id: { notIn: snapshot.users.map((u) => u.id) } },
    });
    const existingUserIds = (
      await db.user.findMany({ select: { id: true } })
    ).map((u) => u.id);
    await db.user.createMany({
      data: snapshot.users.filter((u) => !existingUserIds.includes(u.id)),
    });
    for (const user of snapshot.users) {
      await db.user.update({
        where: { id: user.id },
        data: { roles: user.roles, wcaAccessToken: user.wcaAccessToken },
      });
    }
    await db.quickAction.createMany({
      data: snapshot.quickActions,
      skipDuplicates: true,
    });
    await db.person.createMany({ data: snapshot.persons });
    await db.staffActivity.createMany({ data: snapshot.staffActivities });
    await db.unofficialEvent.createMany({
      data: snapshot.unofficialEvents.map((e) => ({
        ...e,
        wcif: e.wcif as Prisma.InputJsonValue,
      })),
    });
    await db.competition.createMany({
      data: snapshot.competitions.map((c) => ({
        ...c,
        wcif: c.wcif as Prisma.InputJsonValue,
      })),
    });
  };

  beforeAll(async () => {
    ({ app, db, adminToken } = await createTestApp());
    await listenOnLoopback(app);
    snapshot = {
      competitions: await db.competition.findMany(),
      users: await db.user.findMany(),
      quickActions: await db.quickAction.findMany(),
      persons: await db.person.findMany(),
      staffActivities: await db.staffActivity.findMany(),
      rooms: await db.room.findMany(),
      unofficialEvents: await db.unofficialEvent.findMany(),
    };
    const response = await fetch(
      `${process.env.WCA_ORIGIN}/api/v0/competitions/${IMPORTED_WCA_ID}/wcif/version/2`,
    );
    wcif = await response.json();
  }, 30000);

  afterAll(async () => {
    await restoreSnapshot();
    await app.close();
  }, 30000);

  it('refuses to import over an existing competition and touches nothing', async () => {
    const usersBefore = await db.user.count();

    const res = await request(server())
      .get(`/competition/import/${IMPORTED_WCA_ID}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);

    expect(res.body.message).toBe('Competition already exists');
    expect(await db.user.count()).toBe(usersBefore);
    const competitions = await db.competition.findMany();
    expect(competitions.map((c) => c.wcaId)).toEqual(
      snapshot.competitions.map((c) => c.wcaId),
    );
  });

  describe('as an FKMTime admin account', () => {
    let otherUserId: string;

    beforeAll(async () => {
      await clearCompetition();
      const other = await db.user.create({
        data: { username: 'e2e-setup-import-bystander', roles: [Role.STAFF] },
      });
      otherUserId = other.id;
    });

    it('imports the competition, its persons, staff assignments and rooms', async () => {
      const res = await request(server())
        .get(`/competition/import/${IMPORTED_WCA_ID}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toMatchObject({
        id: expect.any(String),
        wcaId: IMPORTED_WCA_ID,
        name: wcif.name,
        countryIso2: wcif.countryIso2 ?? null,
        sendingResultsFrequency: 'AFTER_SOLVE',
        wcif: expect.objectContaining({ id: IMPORTED_WCA_ID }),
      });

      const accepted = acceptedPersons();
      expect(await db.competition.count()).toBe(1);
      expect(await db.person.count()).toBe(accepted.length);
      const sample = accepted[accepted.length - 1];
      expect(
        await db.person.findUnique({
          where: { registrantId: sample.registrantId },
        }),
      ).toMatchObject({ name: sample.name });
      expect(await db.staffActivity.count()).toBe(
        accepted.reduce((sum, p) => sum + p.assignments.length, 0),
      );
      const roomNames = (await db.room.findMany()).map((r) => r.name);
      wcif.schedule.venues
        .flatMap((v) => v.rooms)
        .forEach((room) => expect(roomNames).toContain(room.name));
    });

    it('removes every other user account', async () => {
      expect(
        await db.user.findUnique({ where: { id: otherUserId } }),
      ).toBeNull();
      expect(
        await db.user.findFirst({ where: { username: 'admin' } }),
      ).not.toBeNull();
    });

    it('syncs persons, assignments and unofficial events from the public WCIF', async () => {
      const sample = acceptedPersons()[0];
      await db.person.update({
        where: { registrantId: sample.registrantId },
        data: { name: 'Renamed Locally' },
      });
      const person = await db.person.findUnique({
        where: { registrantId: sample.registrantId },
      });
      const deletedAssignments = await db.staffActivity.deleteMany({
        where: { personId: person.id },
      });
      await db.unofficialEvent.create({
        data: {
          eventId: 'mirror',
          wcif: { id: 'mirror', rounds: [], extensions: [] },
        },
      });
      const staffActivitiesBefore = await db.staffActivity.count();

      await request(server())
        .get(`/competition/sync/${IMPORTED_WCA_ID}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(
        await db.person.findUnique({
          where: { registrantId: sample.registrantId },
        }),
      ).toMatchObject({ name: sample.name });
      expect(await db.staffActivity.count()).toBe(
        staffActivitiesBefore + deletedAssignments.count,
      );
      const competition = await db.competition.findFirst();
      const events = (competition.wcif as unknown as Wcif).events.map(
        (e) => e.id,
      );
      expect(events).toEqual([...wcif.events.map((e) => e.id), 'mirror']);
    });

    it('returns 404 when syncing a competition the WCA does not know', async () => {
      await request(server())
        .get('/competition/sync/NoSuchCompetition2099')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('as a WCA delegate of the competition', () => {
    let delegateToken: string;

    it('gets the DELEGATE role when logging in with WCA', async () => {
      const { token, userInfo } = await loginWithWca(DELEGATE_CODE);

      expect(userInfo.roles).toEqual([Role.DELEGATE]);
      delegateToken = token;
    });

    it('syncs using the private WCIF', async () => {
      const sample = acceptedPersons()[1];
      await db.person.update({
        where: { registrantId: sample.registrantId },
        data: { name: 'Renamed Again' },
      });

      await request(server())
        .get(`/competition/sync/${IMPORTED_WCA_ID}`)
        .set('Authorization', `Bearer ${delegateToken}`)
        .expect(200);

      expect(
        await db.person.findUnique({
          where: { registrantId: sample.registrantId },
        }),
      ).toMatchObject({ name: sample.name });
      expect(await db.person.count()).toBe(acceptedPersons().length);
    });
  });

  describe('importing with a WCA account', () => {
    let outsiderToken: string;

    beforeAll(async () => {
      await clearCompetition();
    });

    it('lets anyone log in as organizer while no competition exists', async () => {
      const { token, userInfo } = await loginWithWca(OUTSIDER_CODE);

      expect(userInfo.roles).toEqual([Role.ORGANIZER]);
      outsiderToken = token;
    });

    it('returns 404 for a competition the WCA does not know', async () => {
      await request(server())
        .get('/competition/import/NoSuchCompetition2099')
        .set('Authorization', `Bearer ${outsiderToken}`)
        .expect(404);
      expect(await db.competition.count()).toBe(0);
    });

    it('refuses the import for someone who does not manage the competition', async () => {
      const res = await request(server())
        .get(`/competition/import/${IMPORTED_WCA_ID}`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .expect(403);

      expect(res.body.message).toBe(
        'You are not allowed to import this competition',
      );
      expect(await db.competition.count()).toBe(0);
      expect(await db.person.count()).toBe(0);
    });

    it('keeps other users when the import is refused', async () => {
      expect(
        await db.user.findFirst({ where: { username: 'admin' } }),
      ).not.toBeNull();
    });

    it("imports for the competition's delegate and gives them the DELEGATE role", async () => {
      const { token, userInfo } = await loginWithWca(DELEGATE_CODE);

      await request(server())
        .get(`/competition/import/${IMPORTED_WCA_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(await db.competition.count()).toBe(1);
      const users = await db.user.findMany();
      expect(users.map((u) => u.id)).toEqual([userInfo.id]);
      expect(users[0].roles).toEqual([Role.DELEGATE]);
    });
  });
});
