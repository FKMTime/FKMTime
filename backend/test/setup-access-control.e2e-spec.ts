import { INestApplication } from '@nestjs/common';
import { Role } from '@prisma/client';
import { DbService } from 'src/db/db.service';
import * as request from 'supertest';

import { createTestApp } from './helpers/app.helper';
import { listenOnLoopback } from './helpers/loopback.helper';
import {
  createRoleUsers,
  createUserWithRoles,
  deleteSetupUsers,
  TestUser,
} from './helpers/setup-roles.helper';

type Method = 'get' | 'post' | 'put' | 'delete';
type Level = 'jwt' | 'organizer' | 'delegate' | 'admin';

const SUFFIX = 'acl';
const FAKE_ID = '00000000-0000-4000-8000-000000000000';

/** Roles that must be rejected with 403 at each guard level */
const insufficientRoles: Record<Level, Exclude<Role, 'ADMIN'>[]> = {
  jwt: [],
  organizer: [Role.STAFF, Role.STAGE_LEADER],
  delegate: [Role.ORGANIZER, Role.STAFF, Role.STAGE_LEADER],
  admin: [Role.ORGANIZER, Role.DELEGATE, Role.STAFF, Role.STAGE_LEADER],
};

const protectedEndpoints: [Method, string, Level][] = [
  // competition
  ['get', '/competition', 'jwt'],
  ['get', '/competition/statistics', 'jwt'],
  ['get', '/competition/rounds', 'jwt'],
  ['get', '/competition/activities?venueId=1&roomId=1&date=2024-05-24', 'jwt'],
  ['get', '/competition/rooms', 'jwt'],
  ['get', '/competition/rooms/progress', 'jwt'],
  ['get', '/competition/settings', 'organizer'],
  ['get', '/competition/import/SomeCompetition2024', 'organizer'],
  ['get', '/competition/sync/SomeCompetition2024', 'organizer'],
  ['get', '/competition/available-locales', 'organizer'],
  ['put', '/competition/rooms', 'organizer'],
  ['put', `/competition/settings/${FAKE_ID}`, 'organizer'],
  ['get', `/competition/settings/${FAKE_ID}/devices`, 'organizer'],
  ['put', `/competition/settings/${FAKE_ID}/devices`, 'organizer'],
  ['get', `/competition/rooms/${FAKE_ID}/next-groups`, 'organizer'],
  ['get', `/competition/rooms/${FAKE_ID}/previous-groups`, 'organizer'],
  // scramble sets
  ['get', '/scramble-set/counts', 'delegate'],
  ['get', '/scramble-set/333-r1', 'delegate'],
  ['post', '/scramble-set/import', 'delegate'],
  ['delete', '/scramble-set/all', 'delegate'],
  ['delete', '/scramble-set/round/333-r1', 'delegate'],
  ['delete', `/scramble-set/${FAKE_ID}`, 'delegate'],
  // scrambling devices
  ['get', '/scrambling-device', 'delegate'],
  ['post', '/scrambling-device', 'delegate'],
  ['get', `/scrambling-device/${FAKE_ID}/code`, 'delegate'],
  ['put', `/scrambling-device/${FAKE_ID}`, 'delegate'],
  ['delete', `/scrambling-device/${FAKE_ID}`, 'delegate'],
  // devices
  ['get', '/device', 'organizer'],
  ['post', '/device', 'organizer'],
  ['put', `/device/${FAKE_ID}`, 'organizer'],
  ['delete', `/device/${FAKE_ID}`, 'organizer'],
  ['post', '/device/upload-firmware', 'admin'],
  // users
  ['get', '/user', 'organizer'],
  ['post', '/user', 'organizer'],
  ['put', `/user/password/${FAKE_ID}`, 'organizer'],
  ['put', `/user/${FAKE_ID}`, 'organizer'],
  ['delete', `/user/${FAKE_ID}`, 'organizer'],
  // events
  ['get', '/events/unofficial', 'organizer'],
  ['post', '/events', 'organizer'],
  ['put', `/events/${FAKE_ID}`, 'organizer'],
  ['delete', `/events/${FAKE_ID}`, 'organizer'],
  // settings
  ['get', '/settings', 'jwt'],
  ['put', '/settings', 'jwt'],
  ['get', '/settings/quick-actions', 'delegate'],
  ['post', '/settings/quick-actions', 'delegate'],
  ['put', `/settings/quick-actions/${FAKE_ID}`, 'delegate'],
  ['delete', `/settings/quick-actions/${FAKE_ID}`, 'delegate'],
  // auth
  ['get', '/auth/me', 'jwt'],
  ['put', '/auth/password/change', 'jwt'],
];

const scramblingDeviceEndpoints: [Method, string][] = [
  ['get', '/competition/for/scrambling-device'],
  ['get', '/scrambling/room'],
  ['get', '/scrambling/sets/round/333-r1'],
  ['get', `/scrambling/sets/${FAKE_ID}`],
  ['post', `/scrambling/sets/${FAKE_ID}/unlock`],
  ['get', '/scrambling/scramble/12345/333-r1'],
  ['post', '/scrambling/scramble'],
  ['get', '/scrambling/person/12345'],
];

describe('Access control for competition setup & scrambling (e2e)', () => {
  let app: INestApplication;
  let db: DbService;
  let users: Record<Exclude<Role, 'ADMIN'>, TestUser>;

  beforeAll(async () => {
    ({ app, db } = await createTestApp());
    await listenOnLoopback(app);
    await deleteSetupUsers(db, SUFFIX);
    users = await createRoleUsers(app, db, SUFFIX);
  }, 30000);

  afterAll(async () => {
    await deleteSetupUsers(db, SUFFIX);
    await app.close();
  }, 30000);

  const call = (method: Method, url: string) =>
    request(app.getHttpServer())[method](url);

  describe.each(protectedEndpoints)('%s %s (%s)', (method, url, level) => {
    it('returns 401 without a token', async () => {
      await call(method, url).expect(401);
    });

    if (level === 'jwt') {
      it('returns 401 with a malformed token', async () => {
        await call(method, url)
          .set('Authorization', 'Bearer not-a-jwt')
          .expect(401);
      });
    }

    const forbidden = insufficientRoles[level];
    if (forbidden.length > 0) {
      it.each(forbidden)('returns 403 for %s', async (role) => {
        await call(method, url)
          .set('Authorization', `Bearer ${users[role].token}`)
          .expect(403);
      });
    }
  });

  describe.each(scramblingDeviceEndpoints)(
    '%s %s (scrambling device token)',
    (method, url) => {
      it('returns 403 without a token', async () => {
        await call(method, url).expect(403);
      });

      it('returns 403 with an unknown device token', async () => {
        await call(method, url)
          .set('Authorization', 'Token 0123456789abcdef')
          .expect(403);
      });
    },
  );

  it('returns 401 for a malformed JWT on role-guarded endpoints', async () => {
    for (const [method, url] of protectedEndpoints.filter(
      ([, , level]) => level !== 'jwt',
    )) {
      await call(method, url)
        .set('Authorization', 'Bearer not-a-jwt')
        .expect(401);
    }
  });

  it('returns 403 for a user JWT on scrambling-device endpoints', async () => {
    for (const [method, url] of scramblingDeviceEndpoints) {
      await call(method, url)
        .set('Authorization', `Bearer ${users.DELEGATE.token}`)
        .expect(403);
    }
  });

  describe('roles that are allowed in', () => {
    it.each([
      ['/competition/rounds', Role.STAFF],
      ['/competition/rooms', Role.STAGE_LEADER],
      ['/settings', Role.STAFF],
      ['/competition/settings', Role.ORGANIZER],
      ['/device', Role.DELEGATE],
      ['/user', Role.ORGANIZER],
      ['/events/unofficial', Role.ORGANIZER],
      ['/scramble-set/counts', Role.DELEGATE],
      ['/scrambling-device', Role.DELEGATE],
      ['/settings/quick-actions', Role.DELEGATE],
    ] as [string, Exclude<Role, 'ADMIN'>][])(
      'GET %s is allowed for %s',
      async (url, role) => {
        await request(app.getHttpServer())
          .get(url)
          .set('Authorization', `Bearer ${users[role].token}`)
          .expect(200);
      },
    );
  });

  describe('token of a deleted user', () => {
    it('returns 401 on a role-guarded endpoint', async () => {
      const user = await createUserWithRoles(app, db, `gone-${SUFFIX}`, [
        Role.ORGANIZER,
      ]);
      await db.user.delete({ where: { id: user.id } });

      await request(app.getHttpServer())
        .get('/device')
        .set('Authorization', `Bearer ${user.token}`)
        .expect(401);
    });
  });
});
