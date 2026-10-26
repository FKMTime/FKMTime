import { INestApplication } from '@nestjs/common';
import { Role } from '@prisma/client';
import { DbService } from 'src/db/db.service';
import * as request from 'supertest';

import { createTestApp } from './helpers/app.helper';
import {
  DummyWcaAccount,
  getGeneratedCompetition,
} from './helpers/dummy-wca.helper';
import { listenOnLoopback } from './helpers/loopback.helper';
import {
  createUserWithRoles,
  deleteSetupUsers,
  SETUP_USER_PREFIX,
  TestUser,
} from './helpers/setup-roles.helper';

const SUFFIX = 'user-management';
const FAKE_ID = '00000000-0000-4000-8000-000000000000';

const username = (name: string) => `${SETUP_USER_PREFIX}${name}-${SUFFIX}`;

describe('User management (e2e)', () => {
  let app: INestApplication;
  let db: DbService;
  let organizer: TestUser;
  let delegate: TestUser;
  let staffUserId: string;
  /** Dummy WCA account looked up by WCA ID when creating a WCA-linked user */
  let wcaAccount: DummyWcaAccount;

  const server = () => app.getHttpServer();
  const as = (user: TestUser, req: request.Test) =>
    req.set('Authorization', `Bearer ${user.token}`);
  const cleanUp = async () => {
    await deleteSetupUsers(db, SUFFIX);
    await db.user.deleteMany({ where: { wcaUserId: wcaAccount.wcaUserId } });
  };

  beforeAll(async () => {
    ({ app, db } = await createTestApp());
    wcaAccount = (await getGeneratedCompetition()).accounts.outsider;
    await listenOnLoopback(app);
    await cleanUp();
    organizer = await createUserWithRoles(app, db, `organizer-${SUFFIX}`, [
      Role.ORGANIZER,
    ]);
    delegate = await createUserWithRoles(app, db, `delegate-${SUFFIX}`, [
      Role.DELEGATE,
    ]);
  }, 30000);

  afterAll(async () => {
    await cleanUp();
    await app.close();
  }, 30000);

  describe('POST /user', () => {
    it('lets an organizer create a staff account with a hashed password', async () => {
      const res = await as(organizer, request(server()).post('/user'))
        .send({
          username: username('staff'),
          fullName: 'Staff Member',
          password: 'staff-password',
          roles: [Role.STAFF, Role.STAGE_LEADER],
        })
        .expect(201);

      expect(res.body).toEqual({ message: 'User created successfully' });
      const fromDb = await db.user.findUnique({
        where: { username: username('staff') },
      });
      expect(fromDb).toMatchObject({
        fullName: 'Staff Member',
        roles: [Role.STAFF, Role.STAGE_LEADER],
      });
      expect(fromDb.password).toMatch(/^\$2[aby]\$12\$/);
      staffUserId = fromDb.id;
    });

    it('lets the new account log in with its password', async () => {
      const res = await request(server())
        .post('/auth/login')
        .send({ username: username('staff'), password: 'staff-password' })
        .expect(200);

      expect(res.body.userInfo).toMatchObject({
        id: staffUserId,
        roles: [Role.STAFF, Role.STAGE_LEADER],
      });
    });

    it.each([
      ['an organizer', Role.DELEGATE, 'organizer'],
      ['an organizer', Role.ADMIN, 'organizer'],
      ['a delegate', Role.ADMIN, 'delegate'],
    ] as const)('refuses %s granting %s', async (_, role, who) => {
      const actor = who === 'organizer' ? organizer : delegate;

      const res = await as(actor, request(server()).post('/user'))
        .send({
          username: username(`escalated-${role.toLowerCase()}`),
          fullName: 'Escalated',
          password: 'password',
          roles: [Role.STAFF, role],
        })
        .expect(403);

      expect(res.body.message).toBe(
        'You cannot assign roles higher than your own',
      );
      expect(
        await db.user.count({
          where: { username: username(`escalated-${role.toLowerCase()}`) },
        }),
      ).toBe(0);
    });

    it('lets a delegate create an organizer', async () => {
      await as(delegate, request(server()).post('/user'))
        .send({
          username: username('second-organizer'),
          fullName: 'Second Organizer',
          password: 'password',
          roles: [Role.ORGANIZER],
        })
        .expect(201);
    });

    it('requires a password for a username account', async () => {
      const res = await as(organizer, request(server()).post('/user'))
        .send({
          username: username('no-password'),
          fullName: 'No Password',
          roles: [Role.STAFF],
        })
        .expect(400);

      expect(res.body.message).toBe('Password is required');
    });

    it('rejects a taken username with 409', async () => {
      await as(organizer, request(server()).post('/user'))
        .send({
          username: username('staff'),
          fullName: 'Duplicate',
          password: 'password',
          roles: [Role.STAFF],
        })
        .expect(409);
    });

    it('creates a WCA-linked account from a WCA ID', async () => {
      await as(organizer, request(server()).post('/user'))
        .send({
          wcaId: wcaAccount.wcaId,
          fullName: 'WCA Linked Staff',
          roles: [Role.STAFF],
        })
        .expect(201);

      expect(
        await db.user.findFirst({ where: { wcaUserId: wcaAccount.wcaUserId } }),
      ).toMatchObject({
        fullName: 'WCA Linked Staff',
        username: null,
        password: null,
        roles: [Role.STAFF],
      });
    });

    it('returns 404 for an unknown WCA ID', async () => {
      await as(organizer, request(server()).post('/user'))
        .send({ wcaId: '2099NONE01', fullName: 'Nobody', roles: [] })
        .expect(404);
    });
  });

  describe('GET /user', () => {
    it('lists users sorted by username without password hashes', async () => {
      const res = await as(organizer, request(server()).get('/user')).expect(
        200,
      );

      const staff = res.body.find((u: { id: string }) => u.id === staffUserId);
      expect(staff).toEqual({
        id: staffUserId,
        username: username('staff'),
        fullName: 'Staff Member',
        roles: [Role.STAFF, Role.STAGE_LEADER],
        wcaUserId: null,
        avatarUrl: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
      const usernames = res.body
        .map((u: { username: string | null }) => u.username)
        .filter((u: string | null) => u !== null);
      expect(usernames).toEqual([...usernames].sort());
    });
  });

  describe('PUT /user/:id', () => {
    it('updates name, username and roles', async () => {
      const res = await as(
        organizer,
        request(server()).put(`/user/${staffUserId}`),
      )
        .send({
          username: username('staff-renamed'),
          fullName: 'Renamed Staff',
          roles: [Role.STAFF],
        })
        .expect(200);

      expect(res.body).toEqual({ message: 'User updated successfully' });
      expect(
        await db.user.findUnique({ where: { id: staffUserId } }),
      ).toMatchObject({
        username: username('staff-renamed'),
        fullName: 'Renamed Staff',
        roles: [Role.STAFF],
      });
    });

    it('refuses an organizer promoting someone to delegate', async () => {
      await as(organizer, request(server()).put(`/user/${staffUserId}`))
        .send({
          username: username('staff-renamed'),
          fullName: 'Renamed Staff',
          roles: [Role.DELEGATE],
        })
        .expect(403);
      expect(
        (await db.user.findUnique({ where: { id: staffUserId } })).roles,
      ).toEqual([Role.STAFF]);
    });

    it('refuses to clear the username of a non-WCA account', async () => {
      await as(organizer, request(server()).put(`/user/${staffUserId}`))
        .send({ username: '', fullName: 'Renamed Staff', roles: [Role.STAFF] })
        .expect(400);
    });

    it('rejects a username taken by someone else with 409', async () => {
      await as(organizer, request(server()).put(`/user/${staffUserId}`))
        .send({
          username: organizer.username,
          fullName: 'Renamed Staff',
          roles: [Role.STAFF],
        })
        .expect(409);
    });

    it('returns 404 for an unknown user', async () => {
      await as(organizer, request(server()).put(`/user/${FAKE_ID}`))
        .send({ username: 'ghost', fullName: 'Ghost', roles: [] })
        .expect(404);
    });
  });

  describe('PUT /user/password/:id', () => {
    it('sets a new password that works for login', async () => {
      await as(
        organizer,
        request(server()).put(`/user/password/${staffUserId}`),
      )
        .send({ password: 'brand-new-password' })
        .expect(200);

      await request(server())
        .post('/auth/login')
        .send({
          username: username('staff-renamed'),
          password: 'brand-new-password',
        })
        .expect(200);
      await request(server())
        .post('/auth/login')
        .send({
          username: username('staff-renamed'),
          password: 'staff-password',
        })
        .expect(401);
    });

    it('rejects an empty password', async () => {
      await as(
        organizer,
        request(server()).put(`/user/password/${staffUserId}`),
      )
        .send({ password: '' })
        .expect(400);
    });
  });

  describe('DELETE /user/:id', () => {
    it('deletes the user', async () => {
      await as(
        organizer,
        request(server()).delete(`/user/${staffUserId}`),
      ).expect(204);

      expect(
        await db.user.findUnique({ where: { id: staffUserId } }),
      ).toBeNull();
    });

    it('returns 404 for an unknown user', async () => {
      await as(organizer, request(server()).delete(`/user/${FAKE_ID}`)).expect(
        404,
      );
    });
  });
});
