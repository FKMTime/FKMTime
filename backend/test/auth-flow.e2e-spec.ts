import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { sha512 } from 'js-sha512';
import { DbService } from 'src/db/db.service';
import * as request from 'supertest';

import { createTestApp } from './helpers/app.helper';
import {
  createUserWithRoles,
  deleteSetupUsers,
  SETUP_USER_PREFIX,
} from './helpers/setup-roles.helper';

const SUFFIX = 'auth-flow';
const REDIRECT_URI = 'http://localhost:5173/auth/login';
/** Dummy WCA user who organizes (but does not delegate) the seeded competition */
const ORGANIZER_CODE = 'code-2013KOSK01';
const ORGANIZER_WCA_USER_ID = 6008;
/** Dummy WCA user with no rights to the seeded competition */
const OUTSIDER_CODE = 'code-2021KULA02';
const OUTSIDER_WCA_USER_ID = 235575;

// Login endpoints allow 5 requests per minute per app instance; createTestApp
// uses one, so each block below starts its own app and stays within budget.
describe('Auth flows (e2e)', () => {
  describe('password login', () => {
    let app: INestApplication;
    let db: DbService;
    const legacyUsername = `${SETUP_USER_PREFIX}legacy-${SUFFIX}`;
    const wcaLinkedUsername = `${SETUP_USER_PREFIX}wca-linked-${SUFFIX}`;

    beforeAll(async () => {
      ({ app, db } = await createTestApp());
      await deleteSetupUsers(db, SUFFIX);
    }, 30000);

    afterAll(async () => {
      await deleteSetupUsers(db, SUFFIX);
      await app.close();
    }, 30000);

    it('rejects an unknown username with 403', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'e2e-nobody', password: 'whatever' })
        .expect(403);

      expect(res.body.message).toBe('Wrong credentials!');
    });

    it('upgrades a legacy sha512 password to bcrypt on first login', async () => {
      const user = await db.user.create({
        data: {
          username: legacyUsername,
          fullName: 'Legacy User',
          password: sha512('legacy-password'),
          roles: [Role.STAFF, Role.STAFF],
        },
      });

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: legacyUsername, password: 'legacy-password' })
        .expect(200);

      expect(res.body).toEqual({
        token: expect.any(String),
        userInfo: {
          id: user.id,
          username: legacyUsername,
          fullName: 'Legacy User',
          roles: [Role.STAFF, Role.STAFF],
        },
      });
      const fromDb = await db.user.findUnique({ where: { id: user.id } });
      expect(fromDb.password).toMatch(/^\$2[aby]\$12\$/);
      expect(fromDb.roles).toEqual([Role.STAFF]);
    });

    it('still accepts the same password after the upgrade', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: legacyUsername, password: 'legacy-password' })
        .expect(200);
    });

    it('refuses password login for an account linked to WCA', async () => {
      await db.user.create({
        data: {
          username: wcaLinkedUsername,
          password: sha512('linked-password'),
          wcaAccessToken: 'e2e-wca-access-token',
          roles: [Role.STAFF],
        },
      });

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: wcaLinkedUsername, password: 'linked-password' })
        .expect(403);

      expect(res.body.message).toBe('Already logged in with WCA');
    });
  });

  describe('login throttling', () => {
    let app: INestApplication;

    beforeAll(async () => {
      ({ app } = await createTestApp());
    }, 30000);

    afterAll(async () => {
      await app.close();
    }, 30000);

    it('answers 429 after five login attempts within a minute', async () => {
      // createTestApp already used one attempt
      for (let i = 0; i < 4; i++) {
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({ username: 'admin', password: 'wrong' })
          .expect(403);
      }

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'admin', password: 'admin' })
        .expect(429);
    });

    it('throttles WCA login separately from password login', async () => {
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post('/auth/wca/login')
          .send({ code: OUTSIDER_CODE, redirectUri: REDIRECT_URI })
          .expect(403);
      }

      await request(app.getHttpServer())
        .post('/auth/wca/login')
        .send({ code: OUTSIDER_CODE, redirectUri: REDIRECT_URI })
        .expect(429);
    });
  });

  describe('WCA login', () => {
    let app: INestApplication;
    let db: DbService;

    const cleanUp = () =>
      db.user.deleteMany({
        where: {
          wcaUserId: { in: [ORGANIZER_WCA_USER_ID, OUTSIDER_WCA_USER_ID] },
        },
      });

    beforeAll(async () => {
      ({ app, db } = await createTestApp());
      await cleanUp();
    }, 30000);

    afterAll(async () => {
      await cleanUp();
      await app.close();
    }, 30000);

    it('refuses someone who cannot manage the competition', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/wca/login')
        .send({ code: OUTSIDER_CODE, redirectUri: REDIRECT_URI })
        .expect(403);

      expect(res.body.message).toBe(
        'You are not allowed to manage this competition',
      );
      expect(
        await db.user.count({ where: { wcaUserId: OUTSIDER_WCA_USER_ID } }),
      ).toBe(0);
    });

    it('creates an ORGANIZER account for an organizer of the competition', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/wca/login')
        .send({ code: ORGANIZER_CODE, redirectUri: REDIRECT_URI })
        .expect(200);

      expect(res.body.userInfo).toMatchObject({
        id: expect.any(String),
        roles: [Role.ORGANIZER],
        wcaAccessToken: expect.any(String),
      });
      const fromDb = await db.user.findUnique({
        where: { id: res.body.userInfo.id },
      });
      expect(fromDb).toMatchObject({
        wcaUserId: ORGANIZER_WCA_USER_ID,
        roles: [Role.ORGANIZER],
        username: null,
        password: null,
      });

      const me = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${res.body.token}`)
        .expect(200);
      expect(me.body).toMatchObject({
        id: fromDb.id,
        roles: [Role.ORGANIZER],
      });
    });

    it('reuses the account and refreshes its roles on the next login', async () => {
      await db.user.updateMany({
        where: { wcaUserId: ORGANIZER_WCA_USER_ID },
        data: { roles: [Role.STAFF], wcaAccessToken: null },
      });

      const res = await request(app.getHttpServer())
        .post('/auth/wca/login')
        .send({ code: ORGANIZER_CODE, redirectUri: REDIRECT_URI })
        .expect(200);

      const accounts = await db.user.findMany({
        where: { wcaUserId: ORGANIZER_WCA_USER_ID },
      });
      expect(accounts).toHaveLength(1);
      expect(accounts[0]).toMatchObject({
        id: res.body.userInfo.id,
        roles: [Role.ORGANIZER],
        wcaAccessToken: expect.any(String),
        avatarUrl: expect.any(String),
      });
    });

    it('rejects a request without a code', async () => {
      await request(app.getHttpServer())
        .post('/auth/wca/login')
        .send({ redirectUri: REDIRECT_URI })
        .expect(400);
    });
  });

  describe('tokens and passwords', () => {
    let app: INestApplication;
    let db: DbService;

    beforeAll(async () => {
      ({ app, db } = await createTestApp());
      await deleteSetupUsers(db, `tokens-${SUFFIX}`);
    }, 30000);

    afterAll(async () => {
      await deleteSetupUsers(db, `tokens-${SUFFIX}`);
      await app.close();
    }, 30000);

    it('rejects a token signed with another secret', async () => {
      const user = await createUserWithRoles(
        app,
        db,
        `forged-tokens-${SUFFIX}`,
        [Role.STAFF],
      );
      const forged = new JwtService({ secret: 'not-the-server-secret' }).sign({
        userId: user.id,
        roles: [Role.ADMIN],
      });

      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${forged}`)
        .expect(401);
    });

    it('rejects the token of a deleted user', async () => {
      const user = await createUserWithRoles(
        app,
        db,
        `deleted-tokens-${SUFFIX}`,
        [Role.STAFF],
      );
      await db.user.delete({ where: { id: user.id } });

      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${user.token}`)
        .expect(401);
    });

    it('returns the current user without secrets', async () => {
      const user = await createUserWithRoles(app, db, `me-tokens-${SUFFIX}`, [
        Role.STAGE_LEADER,
      ]);

      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${user.token}`)
        .expect(200);

      expect(res.body).toEqual({
        id: user.id,
        username: user.username,
        fullName: expect.any(String),
        roles: [Role.STAGE_LEADER],
        wcaAccessToken: null,
        avatarUrl: null,
      });
    });

    it('changes the password of the current user only', async () => {
      const user = await createUserWithRoles(
        app,
        db,
        `password-tokens-${SUFFIX}`,
        [Role.STAFF],
      );
      await request(app.getHttpServer())
        .put(`/user/password/${user.id}`)
        .set(
          'Authorization',
          `Bearer ${(await createUserWithRoles(app, db, `org-tokens-${SUFFIX}`, [Role.ORGANIZER])).token}`,
        )
        .send({ password: 'first-password' })
        .expect(200);
      const adminBefore = await db.user.findFirst({
        where: { username: 'admin' },
      });

      await request(app.getHttpServer())
        .put('/auth/password/change')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ oldPassword: 'first-password', newPassword: 'second-password' })
        .expect(200);

      const fromDb = await db.user.findUnique({ where: { id: user.id } });
      expect(fromDb.password).toMatch(/^\$2[aby]\$12\$/);
      const adminAfter = await db.user.findFirst({
        where: { username: 'admin' },
      });
      expect(adminAfter.password).toBe(adminBefore.password);
    });

    it('rejects an empty new password', async () => {
      const user = await createUserWithRoles(
        app,
        db,
        `empty-tokens-${SUFFIX}`,
        [Role.STAFF],
      );

      await request(app.getHttpServer())
        .put('/auth/password/change')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ oldPassword: 'x', newPassword: '' })
        .expect(400);
    });
  });
});
