import { INestApplication } from '@nestjs/common';
import { DeviceType, Person, Role, StaffRole } from '@prisma/client';
import { sha512 } from 'js-sha512';
import { DbService } from 'src/db/db.service';
import { getCompetitorGroupInRound } from 'src/device/stationRounds';
import { getTranslation } from 'src/translations/translations';
import * as request from 'supertest';
import { Competition as WCIF } from 'wcif-helpers';

import { createTestApp } from './helpers/app.helper';
import {
  seededPersonPicker,
  WcifLike,
  WcifPerson,
} from './helpers/seed.helper';
import { StationFixtures } from './helpers/station-fixtures.helper';
import {
  startStationSocketServer,
  StationClient,
} from './helpers/station-socket.helper';

/**
 * SPEC-007: a delegate points a station at a round, and it takes attempts
 * for that round while the rest of its room carries on.
 */

// Invented hardware ids, RFID card numbers and device token, unique to this spec
const ESP = {
  pointed: 772001,
  following: 772002,
  attendance: 772003,
  retired: 772004,
};
const CARD = {
  competitor: 7720010,
  other: 7720011,
  judge: 7720012,
};
const SCRAMBLING_TOKEN = 'e2e-custom-round-scrambling-token';
const PREFIX = 'e2e-custom-round';
const ROOM_GROUP = 'skewb-r1-g1';
const POINTED_ROUND = '333-r1';

let sessionCounter = 0;
const newSession = () => `${PREFIX}-session-${++sessionCounter}`;

describe('Stations running a different round (e2e)', () => {
  let app: INestApplication;
  let db: DbService;
  let fixtures: StationFixtures;
  let stationServer: Awaited<ReturnType<typeof startStationSocketServer>>;
  let station: StationClient;
  let delegateToken: string;
  let organizerToken: string;
  let wcif: WCIF;
  let defaultLocale: string;

  let roomId: string;
  let pointedId: string;
  let followingId: string;
  let attendanceId: string;
  let retiredId: string;
  let scramblingDeviceId: string;
  let competitor: Person;
  /** The first solve at the pointed station, resent after it is pointed back */
  let pointedSessionId: string;
  let other: Person;
  let judge: Person;

  const server = () => app.getHttpServer();

  const setRound = (
    deviceIds: string[],
    roundId: string | null,
    token = delegateToken,
  ) =>
    request(server())
      .put('/device/custom-round')
      .set('Authorization', `Bearer ${token}`)
      .send({ deviceIds, roundId });

  const attempt = (overrides: Record<string, unknown> = {}) => ({
    value: 1234,
    valueMs: 12345,
    penalty: 0,
    inspectionTime: 8000,
    solvedAt: new Date().toISOString(),
    espId: ESP.pointed,
    judgeId: CARD.judge,
    competitorId: CARD.competitor,
    isDelegate: false,
    sessionId: newSession(),
    ...overrides,
  });

  const attemptsOf = (personId: string, roundId: string) =>
    db.attempt.findMany({ where: { result: { personId, roundId } } });

  const scanCard = (espId: number, cardId: number) =>
    station.request('PersonInfo', {
      cardId: cardId.toString(),
      espId,
      isCompetitor: true,
    });

  beforeAll(async () => {
    ({ app, db } = await createTestApp());
    stationServer = await startStationSocketServer(app);
    fixtures = new StationFixtures(db, PREFIX);
    await fixtures.purgeLeftovers(Object.values(CARD));
    await db.scramblingDevice.deleteMany({
      where: { name: { startsWith: `${PREFIX}-` } },
    });
    await fixtures.disableResultSubmission();
    const competition = await db.competition.findFirst();
    defaultLocale = competition.defaultLocale;
    wcif = competition.wcif as unknown as WCIF;

    const room = await fixtures.createRoom('room', [ROOM_GROUP]);
    roomId = room.id;
    pointedId = (await fixtures.createDevice('pointed', ESP.pointed, roomId))
      .id;
    followingId = (
      await fixtures.createDevice('following', ESP.following, roomId)
    ).id;
    attendanceId = (
      await fixtures.createDevice(
        'attendance',
        ESP.attendance,
        roomId,
        DeviceType.ATTENDANCE_SCRAMBLER,
      )
    ).id;
    retiredId = (await fixtures.createDevice('retired', ESP.retired, roomId))
      .id;
    await db.device.update({
      where: { id: retiredId },
      data: { retiredAt: new Date() },
    });
    scramblingDeviceId = (
      await db.scramblingDevice.create({
        data: {
          name: `${PREFIX}-scrambling`,
          encryptedToken: sha512(SCRAMBLING_TOKEN),
          room: { connect: { id: roomId } },
        },
      })
    ).id;

    const pick = seededPersonPicker(competition.wcif as unknown as WcifLike);
    const inBoth = (p: WcifPerson) =>
      ['333', 'skewb'].every((id) => p.registration.eventIds.includes(id));
    const hasGroupIn333 = (p: WcifPerson) =>
      getCompetitorGroupInRound(POINTED_ROUND, p.registrantId, wcif) !== null;
    competitor = await fixtures.giveCard(
      pick(
        'in 333 and skewb, with a 333 group',
        (p) => inBoth(p) && hasGroupIn333(p),
      ),
      CARD.competitor,
    );
    other = await fixtures.giveCard(
      pick('in 333 and skewb', inBoth),
      CARD.other,
    );
    judge = await fixtures.giveCard(
      pick('anyone', () => true),
      CARD.judge,
    );

    delegateToken = await fixtures.createUserToken(app, 'delegate', [
      Role.DELEGATE,
    ]);
    organizerToken = await fixtures.createUserToken(app, 'organizer', [
      Role.ORGANIZER,
    ]);

    station = await StationClient.connect(stationServer.path);
  }, 30000);

  afterAll(async () => {
    station?.close();
    stationServer?.destroyConnections();
    if (scramblingDeviceId) {
      await db.scramblingDevice.delete({ where: { id: scramblingDeviceId } });
    }
    await fixtures?.cleanup();
    await app.close();
  }, 30000);

  describe('PUT /device/custom-round', () => {
    it('is for delegates only', async () => {
      await setRound([pointedId], POINTED_ROUND, organizerToken).expect(403);
    });

    it('refuses a round the competition does not have', async () => {
      await setRound([pointedId], '333-r9').expect(400);
    });

    it('refuses anything but stations in use, changing nothing', async () => {
      await setRound([pointedId, attendanceId], POINTED_ROUND).expect(400);
      await setRound([pointedId, retiredId], POINTED_ROUND).expect(400);

      const pointed = await db.device.findUnique({ where: { id: pointedId } });
      expect(pointed.customRoundId).toBeNull();
    });

    it('points a station at a round and lists it', async () => {
      const res = await setRound([pointedId], POINTED_ROUND).expect(200);

      expect(res.body).toEqual({ updated: 1 });
      const devices = await request(server())
        .get('/device')
        .set('Authorization', `Bearer ${delegateToken}`)
        .query({ roomId })
        .expect(200);
      const pointed = devices.body.find((d: any) => d.id === pointedId);
      expect(pointed).toMatchObject({
        customRoundId: POINTED_ROUND,
        customRoundSetAt: expect.any(String),
      });
      expect(
        devices.body.find((d: any) => d.id === followingId).customRoundId,
      ).toBeNull();
    });
  });

  describe('a pointed station', () => {
    it('offers only its round at the card scan', async () => {
      const res = await scanCard(ESP.pointed, CARD.competitor);

      expect(res.type).toBe('PersonInfoResp');
      expect(res.data.possibleGroups.map((g: any) => g.groupId)).toEqual([
        getCompetitorGroupInRound(POINTED_ROUND, competitor.registrantId, wcif),
      ]);
    });

    it('files the attempt in its round, while the room keeps its own', async () => {
      const groupId = getCompetitorGroupInRound(
        POINTED_ROUND,
        competitor.registrantId,
        wcif,
      );
      const pointedAttempt = attempt({ groupId });
      pointedSessionId = pointedAttempt.sessionId;
      const pointedRes = await station.request('EnterAttempt', pointedAttempt);
      const roomRes = await station.request(
        'EnterAttempt',
        attempt({ espId: ESP.following, groupId: ROOM_GROUP }),
      );

      expect(pointedRes.data).toMatchObject({ status: 200, error: false });
      expect(roomRes.data).toMatchObject({ status: 200, error: false });
      expect(await attemptsOf(competitor.id, POINTED_ROUND)).toHaveLength(1);
      expect(await attemptsOf(competitor.id, 'skewb-r1')).toHaveLength(1);
    });

    it("marks the competitor in their own group, and doesn't mark the judge", async () => {
      const groupId = getCompetitorGroupInRound(
        POINTED_ROUND,
        competitor.registrantId,
        wcif,
      );
      const competitorPresence = await db.staffActivity.findUnique({
        where: {
          personId_groupId_role: {
            personId: competitor.id,
            groupId,
            role: StaffRole.COMPETITOR,
          },
        },
      });
      const judgeInPointedRound = await db.staffActivity.count({
        where: {
          personId: judge.id,
          role: StaffRole.JUDGE,
          groupId: { startsWith: `${POINTED_ROUND}-g` },
          deviceId: pointedId,
        },
      });

      expect(competitorPresence).toMatchObject({ deviceId: pointedId });
      expect(judgeInPointedRound).toBe(0);
    });

    it('files a solve sent without a group in its round', async () => {
      const res = await station.request(
        'EnterAttempt',
        attempt({ competitorId: CARD.other }),
      );

      expect(res.data).toMatchObject({ status: 200, error: false });
      expect(await attemptsOf(other.id, POINTED_ROUND)).toHaveLength(1);
    });

    it("refuses a solve started in the room's round and keeps the time", async () => {
      const res = await station.request(
        'EnterAttempt',
        attempt({ competitorId: CARD.other, groupId: ROOM_GROUP }),
      );

      expect(res.data).toMatchObject({
        message: getTranslation('stationRoundChanged', defaultLocale),
        status: 409,
        error: true,
        shouldResetTime: false,
      });
      expect(await attemptsOf(other.id, 'skewb-r1')).toHaveLength(0);
    });

    it('lets the scrambling device in its room scramble for its round', async () => {
      const res = await request(server())
        .get('/scrambling/room')
        .set('Authorization', `Token ${SCRAMBLING_TOKEN}`)
        .expect(200);

      expect(res.body).toMatchObject({
        id: roomId,
        currentGroupIds: [ROOM_GROUP],
        stationRounds: [
          { roundId: POINTED_ROUND, stationNames: [`${PREFIX}-pointed`] },
        ],
      });
    });
  });

  describe('back to the room', () => {
    it("clears the round, so the station takes the room's groups again", async () => {
      await setRound([pointedId], null).expect(200);

      const pointed = await db.device.findUnique({ where: { id: pointedId } });
      expect(pointed).toMatchObject({
        customRoundId: null,
        customRoundSetAt: null,
        customRoundSetById: null,
      });
      const scan = await scanCard(ESP.pointed, CARD.other);
      expect(scan.data.possibleGroups.map((g: any) => g.groupId)).toEqual([
        ROOM_GROUP,
      ]);
    });

    it('refuses a solve started while it was pointed', async () => {
      const res = await station.request(
        'EnterAttempt',
        attempt({
          competitorId: CARD.other,
          groupId: `${POINTED_ROUND}-g1`,
        }),
      );

      expect(res.data).toMatchObject({ status: 409, shouldResetTime: false });
      expect(await attemptsOf(other.id, POINTED_ROUND)).toHaveLength(1);
    });

    it('answers a solve resent after a lost reply as already entered', async () => {
      const res = await station.request(
        'EnterAttempt',
        attempt({
          sessionId: pointedSessionId,
          groupId: getCompetitorGroupInRound(
            POINTED_ROUND,
            competitor.registrantId,
            wcif,
          ),
        }),
      );

      expect(res.data).toMatchObject({
        message: getTranslation('attemptAlreadyEntered', defaultLocale),
        status: 409,
        shouldResetTime: true,
      });
      expect(await attemptsOf(competitor.id, POINTED_ROUND)).toHaveLength(1);
    });

    it("still files a solve from the room's previous group of the same round", async () => {
      const res = await station.request(
        'EnterAttempt',
        attempt({ competitorId: CARD.other, groupId: 'skewb-r1-g9' }),
      );

      expect(res.data).toMatchObject({ status: 200, error: false });
      expect(await attemptsOf(other.id, 'skewb-r1')).toHaveLength(1);
    });
  });
});
