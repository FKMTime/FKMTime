import { INestApplication } from '@nestjs/common';
import * as CryptoJS from 'crypto-js';
import { sha512 } from 'js-sha512';
import { DbService } from 'src/db/db.service';
import * as request from 'supertest';

import {
  AttemptStatus,
  AttemptType,
  Role,
} from '../src/generated/prisma/client';
import { found } from '../src/test-utils/found';
import { createTestApp } from './helpers/app.helper';
import { listenOnLoopback } from './helpers/loopback.helper';
import {
  createUserWithRoles,
  deleteSetupUsers,
  TestUser,
} from './helpers/setup-roles.helper';

const SUFFIX = 'scrambling';
const ROUND_ID = 'clock-r1';
const SET_PASSWORD = 'e2e-scramble-password';
const CARD_ID = 'e2e-setup-card-1001';
const DEVICE_NAME = 'e2e-setup-scrambler-tablet';
const FAKE_ID = '00000000-0000-4000-8000-000000000000';

const scrambles = [
  'UR3+ DR2- DL1+ UL4- U2+ R5- D0+ L3- ALL1+ y2 U1+ R2-',
  'UR1- DR4+ DL2+ UL3+ U5- R1+ D3- L2+ ALL4- y2 U3- R0+',
  'UR2+ DR3- DL5+ UL1- U4+ R2- D1+ L5- ALL2+ y2 U2- R4+',
  'UR4- DR1+ DL3- UL2+ U1- R3+ D5- L1+ ALL3- y2 U4+ R1-',
  'UR5+ DR2+ DL4- UL5- U3+ R4- D2+ L4- ALL5+ y2 U5- R3+',
];
const extraScrambles = [
  'UR1+ DR1+ DL1+ UL1+ U1+ R1+ D1+ L1+ ALL1+ y2 U1+ R1+',
  'UR2- DR2- DL2- UL2- U2- R2- D2- L2- ALL2- y2 U2- R2-',
];

const encrypt = (scramble: string) =>
  CryptoJS.AES.encrypt(scramble, SET_PASSWORD).toString();

/**
 * The whole scrambler-device process: a delegate registers a tablet, pairs it
 * with a one-time code, and the tablet then fetches, unlocks and records
 * scrambles for competitors.
 */
describe('Scrambling device flow (e2e)', () => {
  let app: INestApplication;
  let db: DbService;
  let delegate: TestUser;
  let roomId: string;
  let otherRoomId: string;
  let competitor: { id: string; name: string; cardId: string | null };
  let scrambler: { id: string; name: string };
  let otherScrambler: { id: string; name: string };

  let deviceId: string;
  let oneTimeCode: string;
  let deviceToken: string;
  let scrambleSetId: string;

  const server = () => app.getHttpServer();
  const asDelegate = (req: request.Test) =>
    req.set('Authorization', `Bearer ${delegate.token}`);
  const asDevice = (req: request.Test) =>
    req.set('Authorization', `Token ${deviceToken}`);

  beforeAll(async () => {
    ({ app, db } = await createTestApp());
    await listenOnLoopback(app);
    await deleteSetupUsers(db, SUFFIX);
    delegate = await createUserWithRoles(app, db, `delegate-${SUFFIX}`, [
      Role.DELEGATE,
    ]);
    const rooms = await db.room.findMany({ orderBy: { name: 'asc' } });
    roomId = rooms[0].id;
    otherRoomId = rooms[1].id;
    competitor = found(
      await db.person.findFirst({
        where: { registrantId: 3 },
        select: { id: true, name: true, cardId: true },
      }),
      'competitor',
    );
    scrambler = found(
      await db.person.findFirst({
        where: { registrantId: 4 },
        select: { id: true, name: true },
      }),
      'scrambler',
    );
    otherScrambler = found(
      await db.person.findFirst({
        where: { registrantId: 5 },
        select: { id: true, name: true },
      }),
      'other scrambler',
    );
    await db.person.update({
      where: { id: competitor.id },
      data: { cardId: CARD_ID },
    });
    await db.scrambleSet.deleteMany({ where: { roundId: ROUND_ID } });
    await db.result.deleteMany({
      where: { personId: competitor.id, roundId: ROUND_ID },
    });
  }, 30000);

  afterAll(async () => {
    await db.result.deleteMany({
      where: { personId: competitor.id, roundId: ROUND_ID },
    });
    await db.person.update({
      where: { id: competitor.id },
      data: { cardId: competitor.cardId },
    });
    await db.scrambleSet.deleteMany({ where: { roundId: ROUND_ID } });
    await db.scramblingDevice.deleteMany({
      where: { name: { startsWith: DEVICE_NAME } },
    });
    await deleteSetupUsers(db, SUFFIX);
    await app.close();
  }, 30000);

  describe('registering a scrambling device', () => {
    it('rejects a device without a name', async () => {
      await asDelegate(request(server()).post('/scrambling-device'))
        .send({ roomId })
        .expect(400);
    });

    it('creates a scrambling device in a room', async () => {
      const res = await asDelegate(request(server()).post('/scrambling-device'))
        .send({ name: DEVICE_NAME, roomId: otherRoomId })
        .expect(201);

      expect(res.body).toMatchObject({
        id: expect.any(String),
        name: DEVICE_NAME,
        roomId: otherRoomId,
        encryptedToken: null,
        encryptedOneTimeCode: null,
      });
      deviceId = res.body.id;
    });

    it('moves the device to another room', async () => {
      const res = await asDelegate(
        request(server()).put(`/scrambling-device/${deviceId}`),
      )
        .send({ name: DEVICE_NAME, roomId })
        .expect(200);

      expect(res.body).toMatchObject({ id: deviceId, roomId });
      const fromDb = found(
        await db.scramblingDevice.findUnique({ where: { id: deviceId } }),
        'scrambling device',
      );
      expect(fromDb.roomId).toBe(roomId);
    });

    it('lists the device together with its room and without secrets', async () => {
      const res = await asDelegate(
        request(server()).get('/scrambling-device'),
      ).expect(200);

      const device = res.body.find((d: { id: string }) => d.id === deviceId);
      expect(device).toEqual({
        id: deviceId,
        name: DEVICE_NAME,
        room: expect.objectContaining({ id: roomId }),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });
  });

  describe('pairing the device', () => {
    it('generates a 6-digit one-time code and stores only its hash', async () => {
      const res = await asDelegate(
        request(server()).get(`/scrambling-device/${deviceId}/code`),
      ).expect(200);

      expect(res.body).toEqual({ code: expect.stringMatching(/^\d{6}$/) });
      oneTimeCode = res.body.code;
      const fromDb = found(
        await db.scramblingDevice.findUnique({ where: { id: deviceId } }),
        'scrambling device',
      );
      expect(fromDb.encryptedOneTimeCode).toBe(sha512(oneTimeCode));
    });

    it('rejects a wrong one-time code', async () => {
      const wrongCode = oneTimeCode === '123456' ? '654321' : '123456';
      await request(server())
        .post('/scrambling-device/token')
        .send({ code: wrongCode })
        .expect(404);
    });

    it('rejects an empty one-time code', async () => {
      await request(server())
        .post('/scrambling-device/token')
        .send({ code: '' })
        .expect(400);
    });

    it('exchanges the one-time code for a device token', async () => {
      const res = await request(server())
        .post('/scrambling-device/token')
        .send({ code: oneTimeCode })
        .expect(201);

      expect(res.body).toMatchObject({
        token: expect.stringMatching(/^[0-9a-f]{64}$/),
        device: { id: deviceId, name: DEVICE_NAME, roomId },
      });
      deviceToken = res.body.token;

      const fromDb = found(
        await db.scramblingDevice.findUnique({ where: { id: deviceId } }),
        'scrambling device',
      );
      expect(fromDb.encryptedToken).toBe(sha512(deviceToken));
      expect(fromDb.encryptedOneTimeCode).toBeNull();
      expect(res.body.device).not.toHaveProperty('encryptedToken');
      expect(res.body.device).not.toHaveProperty('encryptedOneTimeCode');
    });

    it('does not accept the same one-time code twice', async () => {
      await request(server())
        .post('/scrambling-device/token')
        .send({ code: oneTimeCode })
        .expect(404);
    });

    it('does not accept a code after it expired', async () => {
      const res = await asDelegate(
        request(server()).get(`/scrambling-device/${deviceId}/code`),
      ).expect(200);
      await db.scramblingDevice.update({
        where: { id: deviceId },
        data: { oneTimeCodeExpiresAt: new Date(Date.now() - 1000) },
      });

      await request(server())
        .post('/scrambling-device/token')
        .send({ code: res.body.code })
        .expect(404);
    });

    it('reports whether a token is valid', async () => {
      const valid = await request(server())
        .post('/scrambling-device/token-valid')
        .send({ token: deviceToken })
        .expect(200);
      expect(JSON.parse(valid.text)).toBe(true);

      const invalid = await request(server())
        .post('/scrambling-device/token-valid')
        .send({ token: 'f'.repeat(64) })
        .expect(200);
      expect(JSON.parse(invalid.text)).toBe(false);
    });

    it('rejects a token check without a token', async () => {
      await request(server())
        .post('/scrambling-device/token-valid')
        .send({})
        .expect(400);
    });

    it('returns 404 when generating a code for an unknown device', async () => {
      await asDelegate(
        request(server()).get(`/scrambling-device/${FAKE_ID}/code`),
      ).expect(404);
    });
  });

  describe('device context', () => {
    it('returns the room the device is assigned to', async () => {
      const res = await asDevice(
        request(server()).get('/scrambling/room'),
      ).expect(200);

      const room = found(
        await db.room.findUnique({ where: { id: roomId } }),
        'room',
      );
      expect(res.body).toMatchObject({ id: roomId, name: room.name });
    });

    it('returns competition info for the device', async () => {
      const res = await asDevice(
        request(server()).get('/competition/for/scrambling-device'),
      ).expect(200);

      const competition = found(
        await db.competition.findFirst(),
        'competition',
      );
      expect(res.body).toMatchObject({
        id: competition.id,
        name: competition.name,
        wcaId: competition.wcaId,
        wcif: expect.objectContaining({ id: competition.wcaId }),
      });
      expect(res.body).not.toHaveProperty('scoretakingToken');
    });
  });

  describe('scramble sets on the device', () => {
    beforeAll(async () => {
      await asDelegate(request(server()).post('/scramble-set/import'))
        .send({
          scrambleSets: [
            {
              roundId: ROUND_ID,
              set: 'A',
              scrambles: [
                ...scrambles.map((s, i) => ({
                  num: i + 1,
                  encryptedScramble: encrypt(s),
                  isExtra: false,
                })),
                ...extraScrambles.map((s, i) => ({
                  num: i + 1,
                  encryptedScramble: encrypt(s),
                  isExtra: true,
                })),
              ],
            },
          ],
        })
        .expect(201);
    });

    it('lists the sets of a round with scramble counts', async () => {
      const res = await asDevice(
        request(server()).get(`/scrambling/sets/round/${ROUND_ID}`),
      ).expect(200);

      expect(res.body).toEqual([
        expect.objectContaining({
          id: expect.any(String),
          roundId: ROUND_ID,
          set: 'A',
          scramblesCount: 5,
          extraScramblesCount: 2,
        }),
      ]);
      expect(res.body[0]).not.toHaveProperty('scrambles');
      scrambleSetId = res.body[0].id;
    });

    it('returns a single set by id', async () => {
      const res = await asDevice(
        request(server()).get(`/scrambling/sets/${scrambleSetId}`),
      ).expect(200);

      expect(res.body).toEqual({
        id: scrambleSetId,
        roundId: ROUND_ID,
        set: 'A',
      });
    });

    it('returns 404 for an unknown set', async () => {
      await asDevice(
        request(server()).get(`/scrambling/sets/${FAKE_ID}`),
      ).expect(404);
    });

    it('never reveals scrambles for a wrong password', async () => {
      for (let i = 0; i < 10; i++) {
        const res = await asDevice(
          request(server()).post(`/scrambling/sets/${scrambleSetId}/unlock`),
        ).send({ password: `wrong-password-${i}` });

        expect(res.status).not.toBe(200);
        expect(res.body).not.toHaveProperty('scrambles');
      }
    });

    it('answers 403 for every wrong password', async () => {
      for (let i = 0; i < 20; i++) {
        await asDevice(
          request(server()).post(`/scrambling/sets/${scrambleSetId}/unlock`),
        )
          .send({ password: `wrong-password-${i}` })
          .expect(403);
      }
    });

    it('refuses to unlock a set without a password', async () => {
      await asDevice(
        request(server()).post(`/scrambling/sets/${scrambleSetId}/unlock`),
      )
        .send({})
        .expect(400);
    });

    it('unlocks a set with the right password and returns decryptable scrambles', async () => {
      const res = await asDevice(
        request(server()).post(`/scrambling/sets/${scrambleSetId}/unlock`),
      )
        .send({ password: SET_PASSWORD })
        .expect(200);

      expect(res.body).toMatchObject({ id: scrambleSetId, roundId: ROUND_ID });
      expect(res.body.scrambles).toHaveLength(7);
      const decrypted = res.body.scrambles
        .filter((s: { isExtra: boolean }) => !s.isExtra)
        .sort((a: { num: number }, b: { num: number }) => a.num - b.num)
        .map((s: { encryptedScramble: string }) =>
          CryptoJS.AES.decrypt(s.encryptedScramble, SET_PASSWORD).toString(
            CryptoJS.enc.Utf8,
          ),
        );
      expect(decrypted).toEqual(scrambles);
    });

    it('returns 404 when unlocking an unknown set', async () => {
      await asDevice(
        request(server()).post(`/scrambling/sets/${FAKE_ID}/unlock`),
      )
        .send({ password: SET_PASSWORD })
        .expect(404);
    });
  });

  describe('scrambling for a competitor', () => {
    it('finds the competitor by card', async () => {
      const res = await asDevice(
        request(server()).get(`/scrambling/person/${CARD_ID}`),
      ).expect(200);

      expect(res.body).toMatchObject({
        id: competitor.id,
        name: competitor.name,
        registrantId: 3,
        cardId: CARD_ID,
      });
    });

    it('returns 404 for an unknown card', async () => {
      await asDevice(
        request(server()).get('/scrambling/person/e2e-no-such-card'),
      ).expect(404);
    });

    it('starts with the first standard scramble', async () => {
      const res = await asDevice(
        request(server()).get(`/scrambling/scramble/${CARD_ID}/${ROUND_ID}`),
      ).expect(200);

      expect(res.body).toEqual({
        scrambleData: { num: 1, isExtra: false },
        person: expect.objectContaining({ id: competitor.id }),
      });
    });

    it('returns 404 for scramble data of an unknown card', async () => {
      await asDevice(
        request(server()).get(
          `/scrambling/scramble/e2e-no-such-card/${ROUND_ID}`,
        ),
      ).expect(404);
    });

    it('rejects a scrambled attempt with an invalid round id', async () => {
      await asDevice(request(server()).post('/scrambling/scramble'))
        .send({
          personId: competitor.id,
          scramblerId: scrambler.id,
          roundId: 'clock',
          attemptNumber: 1,
          isExtra: false,
        })
        .expect(400);
    });

    it('records a scrambled attempt', async () => {
      const statsBefore = await request(server())
        .get('/competition/statistics')
        .set('Authorization', `Bearer ${delegate.token}`)
        .expect(200);

      const res = await asDevice(request(server()).post('/scrambling/scramble'))
        .send({
          personId: competitor.id,
          scramblerId: scrambler.id,
          roundId: ROUND_ID,
          attemptNumber: 1,
          isExtra: false,
        })
        .expect(201);

      expect(res.body).toMatchObject({
        attemptNumber: 1,
        status: AttemptStatus.SCRAMBLED,
        type: AttemptType.STANDARD_ATTEMPT,
        scramblerId: scrambler.id,
        value: 0,
        scrambledAt: expect.any(String),
      });
      const attempt = found(
        await db.attempt.findUnique({
          where: { id: res.body.id },
          include: { result: true },
        }),
        'scrambled attempt',
      );
      expect(attempt.result).toMatchObject({
        personId: competitor.id,
        roundId: ROUND_ID,
        eventId: 'clock',
      });

      // Scrambled attempts count towards the scrambler, not towards solves
      const statsAfter = await request(server())
        .get('/competition/statistics')
        .set('Authorization', `Bearer ${delegate.token}`)
        .expect(200);
      expect(statsAfter.body.allAttempts).toBe(statsBefore.body.allAttempts);
      const countFor = (body: {
        scramblerRanking: { personName: string; count: number }[];
      }) =>
        body.scramblerRanking.find((s) => s.personName === scrambler.name)
          ?.count ?? 0;
      expect(countFor(statsAfter.body)).toBe(countFor(statsBefore.body) + 1);
    });

    it('keeps offering the same scramble until the attempt is solved', async () => {
      const res = await asDevice(
        request(server()).get(`/scrambling/scramble/${CARD_ID}/${ROUND_ID}`),
      ).expect(200);

      expect(res.body.scrambleData).toEqual({ num: 1, isExtra: false });
    });

    const sign = (
      attemptNumber: number,
      isExtra: boolean,
      scramblerId = scrambler.id,
    ) =>
      asDevice(request(server()).post('/scrambling/scramble'))
        .send({
          personId: competitor.id,
          scramblerId,
          roundId: ROUND_ID,
          attemptNumber,
          isExtra,
        })
        .expect(201);

    const scrambledAttempts = async (type: AttemptType) =>
      db.attempt.findMany({
        where: {
          result: { personId: competitor.id, roundId: ROUND_ID },
          status: AttemptStatus.SCRAMBLED,
          type,
        },
      });

    it('updates the scrambled attempt when the same scramble is signed again', async () => {
      const [before] = await scrambledAttempts(AttemptType.STANDARD_ATTEMPT);

      const res = await sign(1, false, otherScrambler.id);

      const attempts = await scrambledAttempts(AttemptType.STANDARD_ATTEMPT);
      expect(attempts).toHaveLength(1);
      expect(res.body.id).toBe(before.id);
      // The last sign is who handed the cube over, and when
      expect(attempts[0]).toMatchObject({
        id: before.id,
        attemptNumber: 1,
        scramblerId: otherScrambler.id,
      });
      expect(
        found(attempts[0].scrambledAt, 'scrambledAt').getTime(),
      ).toBeGreaterThan(found(before.scrambledAt, 'scrambledAt').getTime());
    });

    it('moves on to the next scramble once the attempt is solved', async () => {
      const result = found(
        await db.result.findFirst({
          where: { personId: competitor.id, roundId: ROUND_ID },
        }),
        'competitor result',
      );
      await db.attempt.updateMany({
        where: { resultId: result.id, attemptNumber: 1 },
        data: { status: AttemptStatus.STANDARD, value: 950 },
      });

      const res = await asDevice(
        request(server()).get(`/scrambling/scramble/${CARD_ID}/${ROUND_ID}`),
      ).expect(200);

      expect(res.body.scrambleData).toEqual({ num: 2, isExtra: false });
    });

    it('keeps one scrambled attempt when two devices sign the next scramble at once', async () => {
      await Promise.all([
        sign(2, false, scrambler.id),
        sign(2, false, otherScrambler.id),
      ]);

      const attempts = (
        await scrambledAttempts(AttemptType.STANDARD_ATTEMPT)
      ).filter((attempt) => attempt.attemptNumber === 2);
      expect(attempts).toHaveLength(1);
      expect([scrambler.id, otherScrambler.id]).toContain(
        attempts[0].scramblerId,
      );
    });

    it('refuses a sign for a scramble whose attempt was already solved', async () => {
      // A device still showing Scramble 1 after the station entered attempt 1
      const res = await asDevice(request(server()).post('/scrambling/scramble'))
        .send({
          personId: competitor.id,
          scramblerId: scrambler.id,
          roundId: ROUND_ID,
          attemptNumber: 1,
          isExtra: false,
        })
        .expect(409);

      expect(res.body).toMatchObject({
        key: 'attemptAlreadyEntered',
        message: 'Attempt 1 was already entered',
      });
      const attempts = await db.attempt.findMany({
        where: {
          result: { personId: competitor.id, roundId: ROUND_ID },
          attemptNumber: 1,
          type: AttemptType.STANDARD_ATTEMPT,
        },
      });
      expect(attempts).toHaveLength(1);
      expect(attempts[0]).toMatchObject({
        status: AttemptStatus.STANDARD,
        // Still credited to whoever signed it before the solve
        scramblerId: otherScrambler.id,
      });
      const next = await asDevice(
        request(server()).get(`/scrambling/scramble/${CARD_ID}/${ROUND_ID}`),
      ).expect(200);
      expect(next.body.scrambleData).toEqual({ num: 2, isExtra: false });
    });

    it('offers an extra scramble when an extra was granted', async () => {
      const result = found(
        await db.result.findFirst({
          where: { personId: competitor.id, roundId: ROUND_ID },
        }),
        'competitor result',
      );
      await db.attempt.updateMany({
        where: { resultId: result.id, attemptNumber: 1 },
        data: { status: AttemptStatus.EXTRA_GIVEN },
      });

      const res = await asDevice(
        request(server()).get(`/scrambling/scramble/${CARD_ID}/${ROUND_ID}`),
      ).expect(200);

      expect(res.body.scrambleData).toEqual({ num: 1, isExtra: true });
    });

    it('keeps one scrambled extra when the extra scramble is signed twice', async () => {
      await sign(1, true);
      await sign(1, true, otherScrambler.id);

      const extras = await scrambledAttempts(AttemptType.EXTRA_ATTEMPT);
      expect(extras).toHaveLength(1);
      expect(extras[0]).toMatchObject({
        attemptNumber: 1,
        scramblerId: otherScrambler.id,
      });
    });

    it('refuses a sign for an extra that was already solved', async () => {
      const [extra] = await scrambledAttempts(AttemptType.EXTRA_ATTEMPT);
      await db.attempt.update({
        where: { id: extra.id },
        data: { status: AttemptStatus.STANDARD, value: 1010 },
      });

      const res = await asDevice(request(server()).post('/scrambling/scramble'))
        .send({
          personId: competitor.id,
          scramblerId: scrambler.id,
          roundId: ROUND_ID,
          attemptNumber: 1,
          isExtra: true,
        })
        .expect(409);

      expect(res.body).toMatchObject({
        key: 'attemptAlreadyEntered',
        message: 'Extra 1 was already entered',
      });
      expect(await scrambledAttempts(AttemptType.EXTRA_ATTEMPT)).toHaveLength(
        0,
      );
    });

    it('answers a sign for a removed competitor without the already-entered key', async () => {
      await db.result.updateMany({
        where: { personId: competitor.id, roundId: ROUND_ID },
        data: { removedAt: new Date() },
      });

      const res = await asDevice(request(server()).post('/scrambling/scramble'))
        .send({
          personId: competitor.id,
          scramblerId: scrambler.id,
          roundId: ROUND_ID,
          attemptNumber: 2,
          isExtra: true,
        })
        .expect(409);

      expect(res.body.key).toBeUndefined();
      await db.result.updateMany({
        where: { personId: competitor.id, roundId: ROUND_ID },
        data: { removedAt: null },
      });
    });

    it('signals that no attempts are left after the last one', async () => {
      const result = found(
        await db.result.findFirst({
          where: { personId: competitor.id, roundId: ROUND_ID },
        }),
        'competitor result',
      );
      await db.attempt.deleteMany({ where: { resultId: result.id } });
      await db.attempt.createMany({
        data: [1, 2, 3, 4, 5].map((attemptNumber) => ({
          resultId: result.id,
          attemptNumber,
          value: 900 + attemptNumber,
          status: AttemptStatus.STANDARD,
        })),
      });

      const res = await asDevice(
        request(server()).get(`/scrambling/scramble/${CARD_ID}/${ROUND_ID}`),
      ).expect(200);

      expect(res.body.scrambleData).toEqual({ num: -1, isExtra: false });
    });
  });

  describe('removing the device', () => {
    it('deletes the device and revokes its token', async () => {
      await asDelegate(
        request(server()).delete(`/scrambling-device/${deviceId}`),
      ).expect(204);

      expect(
        await db.scramblingDevice.findUnique({ where: { id: deviceId } }),
      ).toBeNull();
      await asDevice(request(server()).get('/scrambling/room')).expect(403);
      const valid = await request(server())
        .post('/scrambling-device/token-valid')
        .send({ token: deviceToken })
        .expect(200);
      expect(JSON.parse(valid.text)).toBe(false);
    });

    it('returns 404 when deleting an unknown device', async () => {
      await asDelegate(
        request(server()).delete(`/scrambling-device/${FAKE_ID}`),
      ).expect(404);
    });
  });
});
