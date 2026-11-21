import { INestApplication } from '@nestjs/common';
import { DbService } from 'src/db/db.service';
import * as request from 'supertest';

import { DeviceType, Person, Role } from '../src/generated/prisma/client';
import { createTestApp } from './helpers/app.helper';
import { seededPersonPicker, WcifLike } from './helpers/seed.helper';
import { StationFixtures } from './helpers/station-fixtures.helper';
import {
  startStationSocketServer,
  StationClient,
} from './helpers/station-socket.helper';

/**
 * SPEC-012: a station in tutorial mode offers newcomers a tutorial solve,
 * runs the whole flow, delegate call included, and saves nothing.
 */

// Invented hardware ids and RFID card numbers, unique to this spec
const ESP = {
  tutorial: 812001,
  attendance: 812002,
  retired: 812003,
};
const CARD = {
  competitor: 8120010,
  judge: 8120011,
};
const PREFIX = 'e2e-tutorial';
const ROOM_GROUP = 'skewb-r1-g1';

let sessionCounter = 0;
const newSession = () => `${PREFIX}-session-${++sessionCounter}`;

describe('Station tutorial mode (e2e)', () => {
  let app: INestApplication;
  let db: DbService;
  let fixtures: StationFixtures;
  let stationServer: Awaited<ReturnType<typeof startStationSocketServer>>;
  let station: StationClient;
  let delegateToken: string;
  let organizerToken: string;

  let tutorialId: string;
  let attendanceId: string;
  let retiredId: string;
  let competitor: Person;

  const server = () => app.getHttpServer();
  const asDelegate = (req: request.Test) =>
    req.set('Authorization', `Bearer ${delegateToken}`);

  const setTutorial = (id: string, enabled: boolean, token = delegateToken) =>
    request(server())
      .put(`/device/${id}/tutorial`)
      .set('Authorization', `Bearer ${token}`)
      .send({ enabled });

  const scanCard = (cardId: number) =>
    station.request('PersonInfo', {
      cardId: cardId.toString(),
      espId: ESP.tutorial,
      isCompetitor: true,
    });

  const attempt = (overrides: Record<string, unknown> = {}) => ({
    value: 1234,
    valueMs: 12345,
    penalty: 0,
    inspectionTime: 8000,
    solvedAt: new Date().toISOString(),
    espId: ESP.tutorial,
    judgeId: CARD.judge,
    competitorId: CARD.competitor,
    isDelegate: false,
    sessionId: newSession(),
    groupId: 'tutorial',
    ...overrides,
  });

  const savedAttempts = () =>
    db.attempt.count({ where: { deviceId: tutorialId } });

  beforeAll(async () => {
    ({ app, db } = await createTestApp());
    stationServer = await startStationSocketServer(app);
    fixtures = new StationFixtures(db, PREFIX);
    await fixtures.purgeLeftovers(Object.values(CARD));
    await fixtures.disableResultSubmission();
    const competition = await db.competition.findFirst();

    const room = await fixtures.createRoom('room', [ROOM_GROUP]);
    tutorialId = (
      await fixtures.createDevice('tutorial', ESP.tutorial, room.id)
    ).id;
    attendanceId = (
      await fixtures.createDevice(
        'attendance',
        ESP.attendance,
        room.id,
        DeviceType.ATTENDANCE_SCRAMBLER,
      )
    ).id;
    retiredId = (await fixtures.createDevice('retired', ESP.retired, room.id))
      .id;
    await db.device.update({
      where: { id: retiredId },
      data: { retiredAt: new Date() },
    });

    // Someone outside the room's round: a tutorial doesn't care
    const pick = seededPersonPicker(competition.wcif as unknown as WcifLike);
    competitor = await fixtures.giveCard(
      pick('not in skewb', (p) => !p.registration.eventIds.includes('skewb')),
      CARD.competitor,
    );
    await fixtures.giveCard(
      pick('anyone else', () => true),
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
    await fixtures?.cleanup();
    await app.close();
  }, 30000);

  describe('PUT /device/:id/tutorial', () => {
    it('is for delegates only', async () => {
      await setTutorial(tutorialId, true, organizerToken).expect(403);
    });

    it('refuses anything but stations in use', async () => {
      await setTutorial(attendanceId, true).expect(400);
      await setTutorial(retiredId, true).expect(400);
    });

    it('starts it and lists when it ends and who started it', async () => {
      await setTutorial(tutorialId, true).expect(200);

      const devices = await asDelegate(request(server()).get('/device'));
      const device = devices.body.find((d: any) => d.id === tutorialId);
      expect(new Date(device.tutorialEndsAt).getTime()).toBeGreaterThan(
        Date.now(),
      );
      expect(device.tutorialStartedBy).toEqual({
        fullName: `${PREFIX}-delegate`,
      });
    });
  });

  describe('a station in tutorial mode', () => {
    it("offers the tutorial to someone outside the room's round", async () => {
      const res = await scanCard(CARD.competitor);

      expect(res.type).toBe('PersonInfoResp');
      expect(res.data.possibleGroups).toEqual([
        expect.objectContaining({ groupId: 'tutorial', useInspection: true }),
      ]);
    });

    it('takes the solve and saves nothing', async () => {
      const res = await station.request('EnterAttempt', attempt());

      expect(res.data).toMatchObject({ status: 200, error: false });
      expect(await savedAttempts()).toBe(0);
      expect(
        await db.result.count({ where: { personId: competitor.id } }),
      ).toBe(0);
    });

    it('turns a delegate call into a tutorial incident the delegate answers', async () => {
      const call = attempt({ isDelegate: true, judgeId: undefined });
      await station.request('EnterAttempt', call);

      const incidents = await asDelegate(
        request(server()).get('/incident/tutorial'),
      ).expect(200);
      const incident = incidents.body.find(
        (i: any) => i.sessionId === call.sessionId,
      );
      expect(incident).toMatchObject({ competitorName: competitor.name });
      const count = await asDelegate(
        request(server()).get('/incident/unresolved/count'),
      );
      expect(count.body.count).toBeGreaterThanOrEqual(1);

      station.clear();
      await asDelegate(
        request(server()).put(`/incident/tutorial/${incident.id}`),
      )
        .send({ value: 1500, penalty: 2, status: 'RESOLVED' })
        .expect(200);
      const answer = await station.waitForType('IncidentResolved');
      expect(answer.data).toEqual({
        espId: ESP.tutorial,
        shouldScanCards: true,
        attempt: { sessionId: call.sessionId, value: 1500, penalty: 2 },
      });

      // The cards are scanned again and the solve resent: still not saved
      const resent = await station.request('EnterAttempt', {
        ...call,
        isDelegate: false,
        judgeId: CARD.judge,
      });
      expect(resent.data).toMatchObject({ status: 200, error: false });
      expect(await savedAttempts()).toBe(0);
      await asDelegate(
        request(server()).put(`/incident/tutorial/${incident.id}`),
      )
        .send({ value: 1500, penalty: 2, status: 'RESOLVED' })
        .expect(404);
    });

    it("doesn't save a tutorial solve that arrives after the mode ended", async () => {
      await setTutorial(tutorialId, false).expect(200);

      const res = await station.request('EnterAttempt', attempt());

      expect(res.data).toMatchObject({ status: 200, error: false });
      expect(await savedAttempts()).toBe(0);
      const device = await db.device.findUnique({ where: { id: tutorialId } });
      expect(device.tutorialEndsAt).toBeNull();
    });

    it("offers the room's round again once ended", async () => {
      const res = await scanCard(CARD.judge);

      expect(
        res.data.possibleGroups?.map((g: any) => g.groupId) ?? [],
      ).not.toContain('tutorial');
    });
  });
});
