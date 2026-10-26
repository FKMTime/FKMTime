import { INestApplication } from '@nestjs/common';
import {
  AttemptStatus,
  AttemptType,
  DeviceType,
  HardwareVersion,
  Person,
  StaffActivityStatus,
  StaffRole,
} from '@prisma/client';
import { AppGateway } from 'src/app.gateway';
import { DbService } from 'src/db/db.service';
import { getTranslation } from 'src/translations/translations';
import * as request from 'supertest';

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

// Invented hardware ids and RFID card numbers, unique to this spec
const ESP = {
  stationA: 771001,
  stationB: 771002,
  stationEmpty: 771003,
  runnerAttendance: 771004,
  scramblerAttendance: 771005,
  stationAttendance: 771006,
  unknown: 771099,
  requested: 771098,
};
const CARD = {
  c1: 7710020,
  c2: 7710021,
  c3: 7710024,
  c4: 7710019,
  judge: 7710025,
  foreignJudge: 7710022,
  notRegistered: 7710016,
  unknown: 7710999,
};

let sessionCounter = 0;
const newSession = () => `e2e-rt-station-session-${++sessionCounter}`;

describe('Station socket protocol (e2e)', () => {
  let app: INestApplication;
  let db: DbService;
  let adminToken: string;
  let fixtures: StationFixtures;
  let stationServer: Awaited<ReturnType<typeof startStationSocketServer>>;
  let station: StationClient;

  let roomAId: string;
  let roomBId: string;
  let stationAId: string;
  let c1: Person;
  let c2: Person;
  let c3: Person;
  let c4: Person;
  let judge: Person;
  let foreignJudge: Person;
  let defaultLocale: string;

  const attempt = (overrides: Record<string, unknown> = {}) => ({
    value: 1234,
    valueMs: 12345,
    penalty: 0,
    inspectionTime: 8000,
    solvedAt: new Date().toISOString(),
    espId: ESP.stationA,
    judgeId: CARD.judge,
    competitorId: CARD.c1,
    isDelegate: false,
    sessionId: newSession(),
    ...overrides,
  });

  const attemptsOf = (personId: string, roundId: string) =>
    db.attempt.findMany({
      where: { result: { personId, roundId } },
      orderBy: [{ type: 'asc' }, { attemptNumber: 'asc' }],
    });

  const errorResponse = (message: string, status: number) =>
    expect.objectContaining({
      type: 'Error',
      error: true,
      data: expect.objectContaining({ message, status, error: true }),
    });

  beforeAll(async () => {
    ({ app, db, adminToken } = await createTestApp());
    stationServer = await startStationSocketServer(app);
    fixtures = new StationFixtures(db, 'e2e-rt-station');
    await fixtures.purgeLeftovers(Object.values(CARD));
    await fixtures.disableResultSubmission();
    defaultLocale = (await db.competition.findFirst()).defaultLocale;

    const roomA = await fixtures.createRoom('room-a', ['333-r1-g1']);
    const roomB = await fixtures.createRoom('room-b', [
      'skewb-r1-g1',
      'clock-r1-g1',
      '333bf-r1-g1',
    ]);
    const emptyRoom = await fixtures.createRoom('room-empty', []);
    roomAId = roomA.id;
    roomBId = roomB.id;

    stationAId = (await fixtures.createDevice('a', ESP.stationA, roomA.id)).id;
    await fixtures.createDevice(
      'b',
      ESP.stationB,
      roomB.id,
      DeviceType.STATION,
      HardwareVersion.V3,
    );
    await fixtures.createDevice('empty', ESP.stationEmpty, emptyRoom.id);
    await fixtures.createDevice(
      'runner-att',
      ESP.runnerAttendance,
      roomB.id,
      DeviceType.ATTENDANCE_RUNNER,
    );
    await fixtures.createDevice(
      'scrambler-att',
      ESP.scramblerAttendance,
      roomB.id,
      DeviceType.ATTENDANCE_SCRAMBLER,
    );
    await fixtures.createDevice('station-att', ESP.stationAttendance, roomB.id);

    // Pick seeded people by what each test needs from them
    const competition = await db.competition.findFirst();
    const pick = seededPersonPicker(competition.wcif as unknown as WcifLike);
    const registeredFor =
      (...eventIds: string[]) =>
      (p: WcifPerson) =>
        eventIds.every((id) => p.registration.eventIds.includes(id));
    c1 = await fixtures.giveCard(
      pick('in room B events', registeredFor('333', 'skewb', 'clock', '333bf')),
      CARD.c1,
    );
    c2 = await fixtures.giveCard(
      pick('in 333 and clock', registeredFor('333', 'clock')),
      CARD.c2,
    );
    c3 = await fixtures.giveCard(pick('in 333', registeredFor('333')), CARD.c3);
    c4 = await fixtures.giveCard(pick('in 333', registeredFor('333')), CARD.c4);
    judge = await fixtures.giveCard(
      pick(
        'from the host country',
        (p) => p.countryIso2 === competition.countryIso2,
      ),
      CARD.judge,
    );
    foreignJudge = await fixtures.giveCard(
      pick('from abroad', (p) => p.countryIso2 !== competition.countryIso2),
      CARD.foreignJudge,
    );
    await fixtures.giveCard(
      pick('not in skewb', (p) => !registeredFor('skewb')(p)),
      CARD.notRegistered,
    );

    station = await StationClient.connect(stationServer.path);
  }, 30000);

  afterAll(async () => {
    station?.close();
    stationServer?.destroyConnections();
    await fixtures?.cleanup();
    await app.close();
  }, 30000);

  describe('connection and status', () => {
    it('pushes the server status to a station as soon as it connects', async () => {
      const status = await station.waitForType('ServerStatus');

      expect(status.tag).toBeUndefined();
      expect(status.data).toMatchObject({
        shouldUpdate: expect.any(Boolean),
        fkmToken: 69420,
        defaultLocale,
        autoSetup: false,
        translations: expect.any(Array),
      });
      expect(status.data.devices).toEqual(
        expect.arrayContaining([
          { espId: ESP.stationA, signKey: ESP.stationA },
          { espId: ESP.runnerAttendance, signKey: ESP.runnerAttendance },
        ]),
      );
    });

    it('answers ServerStatus with the same tag', async () => {
      const res = await station.request('ServerStatus', {});

      expect(res.type).toBe('ServerStatusResp');
      expect(res.error).toBeUndefined();
      expect(res.data.fkmToken).toBe(69420);
      expect(res.data.devices).toContainEqual({
        espId: ESP.stationB,
        signKey: ESP.stationB,
      });
    });

    it('answers AutoSetupSettings with the Wi-Fi settings', async () => {
      const competition = await db.competition.findFirst();
      const res = await station.request('AutoSetupSettings', {});

      expect(res.type).toBe('AutoSetupSettingsResp');
      expect(res.data).toEqual({
        ssid: competition.wifiSsid,
        psk: competition.wifiPassword,
        data: { mdns: competition.mdns, wsUrl: competition.wsUrl },
      });
    });

    it('ignores unknown request types and keeps serving the connection', async () => {
      const unknownTag = station.send('NoSuchRequest', {});
      const res = await station.request('ServerStatus', {});

      expect(res.type).toBe('ServerStatusResp');
      expect(station.pending().some((m) => m.tag === unknownTag)).toBe(false);
    });

    it('handles several packets arriving in one chunk and a packet split across chunks', async () => {
      const first = { type: 'ServerStatus', tag: 9001, data: {} };
      const second = { type: 'AutoSetupSettings', tag: 9002, data: {} };
      const third = JSON.stringify({
        type: 'ServerStatus',
        tag: 9003,
        data: {},
      });

      station.sendRaw(`${JSON.stringify(first)}\0${JSON.stringify(second)}`);
      const r1 = await station.waitFor((m) => m.tag === 9001);
      const r2 = await station.waitFor((m) => m.tag === 9002);
      expect(r1.type).toBe('ServerStatusResp');
      expect(r2.type).toBe('AutoSetupSettingsResp');

      // write the third packet in two halves; the NUL terminator is in the second one
      (station as any).socket.write(third.slice(0, 10));
      (station as any).socket.write(third.slice(10) + '\0');
      const r3 = await station.waitFor((m) => m.tag === 9003);
      expect(r3.type).toBe('ServerStatusResp');
    });

    it('survives a malformed packet and keeps answering', async () => {
      station.sendRaw('{not json');
      const res = await station.request('ServerStatus', {});
      expect(res.type).toBe('ServerStatusResp');
    });
  });

  describe('RequestToConnectDevice', () => {
    it('registers a connection request from an unknown device', async () => {
      const res = await station.request('RequestToConnectDevice', {
        espId: ESP.requested,
        signKey: ESP.requested,
        type: 'STATION',
        hw: 'V4',
      });

      expect(res).toMatchObject({
        type: 'RequestToConnectDeviceResp',
        data: { message: 'Request sent', status: 200, error: false },
      });
      const gateway = app.get(AppGateway, { strict: false });
      expect(gateway.deviceRequests).toContainEqual(
        expect.objectContaining({ espId: ESP.requested }),
      );
      expect(
        await db.device.findFirst({ where: { espId: ESP.requested } }),
      ).toBeNull();
    });

    it('rejects a request from a device that is already registered', async () => {
      const res = await station.request('RequestToConnectDevice', {
        espId: ESP.stationA,
        signKey: ESP.stationA,
        type: 'STATION',
        hw: 'V4',
      });

      expect(res).toEqual(
        errorResponse('Device already exists in database', 409),
      );
      expect(res.tag).toEqual(expect.any(Number));
    });
  });

  describe('UpdateBatteryPercentage', () => {
    it('stores the battery level of a registered device', async () => {
      const res = await station.request('UpdateBatteryPercentage', {
        espId: ESP.stationA,
        batteryPercentage: 42,
      });

      expect(res).toMatchObject({
        type: 'UpdateBatteryPercentageResp',
        data: { status: 200, error: false },
      });
      const device = await db.device.findUnique({ where: { id: stationAId } });
      expect(device.batteryPercentage).toBe(42);
    });

    it('returns an error for an unknown device', async () => {
      const res = await station.request('UpdateBatteryPercentage', {
        espId: ESP.unknown,
        batteryPercentage: 50,
      });

      expect(res).toEqual(errorResponse('Device not found', 404));
    });
  });

  describe('PersonInfo (card scan)', () => {
    it('returns an error for an unknown card', async () => {
      const res = await station.request('PersonInfo', {
        cardId: CARD.unknown.toString(),
        espId: ESP.stationA,
        isCompetitor: true,
      });

      expect(res).toEqual(
        errorResponse(getTranslation('competitorNotFound', defaultLocale), 404),
      );
    });

    it('returns the competitor with the single group of the station room', async () => {
      const res = await station.request('PersonInfo', {
        cardId: CARD.c1.toString(),
        espId: ESP.stationA,
        isCompetitor: true,
      });

      expect(res.type).toBe('PersonInfoResp');
      expect(res.data).toMatchObject({
        id: c1.id,
        registrantId: c1.registrantId,
        cardId: CARD.c1.toString(),
      });
      expect(res.data.possibleGroups).toEqual([
        expect.objectContaining({
          groupId: '333-r1-g1',
          useInspection: true,
          // 333-r1 has a 10:00.00 time limit, sent in milliseconds
          limit: 600000,
          name: expect.stringContaining('R1'),
          secondaryText: expect.any(String),
        }),
      ]);
    });

    it('returns every group of a multi-group room the competitor is registered for', async () => {
      const res = await station.request('PersonInfo', {
        cardId: CARD.c1.toString(),
        espId: ESP.stationB,
        isCompetitor: true,
      });

      expect(res.type).toBe('PersonInfoResp');
      const groups = res.data.possibleGroups.map((g: any) => g.groupId);
      expect(groups.sort()).toEqual(
        ['skewb-r1-g1', '333bf-r1-g1', 'clock-r1-g1'].sort(),
      );
      // V3 hardware gets the long event name in both lines
      const bld = res.data.possibleGroups.find(
        (g: any) => g.groupId === '333bf-r1-g1',
      );
      expect(bld.useInspection).toBe(false);
      expect(bld.name).toBe(bld.secondaryText);
      expect(bld.name).toMatch(/ - R1$/);
    });

    it('returns no groups when the station is unknown', async () => {
      const res = await station.request('PersonInfo', {
        cardId: CARD.judge.toString(),
        espId: ESP.unknown,
        isCompetitor: false,
      });

      expect(res.type).toBe('PersonInfoResp');
      expect(res.data.possibleGroups).toEqual([]);
    });
  });

  describe('EnterAttempt', () => {
    describe('happy path', () => {
      let sessionId: string;

      it('creates the attempt, the result and the attendance', async () => {
        const data = attempt({ competitorId: CARD.c1 });
        sessionId = data.sessionId;

        const res = await station.request('EnterAttempt', data);

        expect(res).toMatchObject({
          type: 'EnterAttemptResp',
          data: {
            message: getTranslation('attemptEntered', 'pl'),
            shouldResetTime: true,
            status: 200,
            error: false,
          },
        });
        const attempts = await attemptsOf(c1.id, '333-r1');
        expect(attempts).toHaveLength(1);
        expect(attempts[0]).toMatchObject({
          attemptNumber: 1,
          type: AttemptType.STANDARD_ATTEMPT,
          status: AttemptStatus.STANDARD,
          value: 1234,
          originalTime: 12345,
          inspectionTime: 8000,
          penalty: 0,
          sessionId,
          judgeId: judge.id,
          deviceId: stationAId,
        });
        const log = await db.attemptEditLog.findFirst({
          where: { attemptId: attempts[0].id },
        });
        expect(log.comment).toBe('Original entry');

        const competitorActivity = await db.staffActivity.findUnique({
          where: {
            personId_groupId_role: {
              personId: c1.id,
              groupId: '333-r1-g1',
              role: StaffRole.COMPETITOR,
            },
          },
        });
        expect(competitorActivity).toMatchObject({
          status: StaffActivityStatus.PRESENT,
          deviceId: stationAId,
        });
        const judgeActivity = await db.staffActivity.findUnique({
          where: {
            personId_groupId_role: {
              personId: judge.id,
              groupId: '333-r1-g1',
              role: StaffRole.JUDGE,
            },
          },
        });
        expect(judgeActivity).toMatchObject({
          status: StaffActivityStatus.PRESENT,
          deviceId: stationAId,
        });
      });

      it('reports the attempt as entered on CheckTimeEntry', async () => {
        const entered = await station.request('CheckTimeEntry', {
          sessionId,
          espId: ESP.stationA,
        });
        const notEntered = await station.request('CheckTimeEntry', {
          sessionId: 'e2e-rt-station-never-sent',
          espId: ESP.stationA,
        });

        expect(entered).toMatchObject({
          type: 'CheckTimeEntryResp',
          data: true,
        });
        expect(notEntered).toMatchObject({
          type: 'CheckTimeEntryResp',
          data: false,
        });
      });

      it('refuses the same session twice without creating a second attempt', async () => {
        const res = await station.request(
          'EnterAttempt',
          attempt({ competitorId: CARD.c1, sessionId }),
        );

        expect(res).toEqual(
          errorResponse(
            getTranslation('attemptAlreadyEntered', defaultLocale),
            400,
          ),
        );
        expect(await attemptsOf(c1.id, '333-r1')).toHaveLength(1);
      });

      it('answers in the competition language before the judge card is checked', async () => {
        const competition = await db.competition.findFirst();
        await db.competition.update({
          where: { id: competition.id },
          data: { defaultLocale: 'pl' },
        });
        try {
          const res = await station.request(
            'EnterAttempt',
            attempt({ competitorId: CARD.c1, sessionId }),
          );

          expect(res.data.message).toBe(
            getTranslation('attemptAlreadyEntered', 'pl'),
          );
          expect(res.data.message).not.toBe(
            getTranslation('attemptAlreadyEntered', 'en'),
          );
        } finally {
          await db.competition.update({
            where: { id: competition.id },
            data: { defaultLocale: competition.defaultLocale },
          });
        }
      });

      it('numbers further attempts and stores +2 and DNF penalties', async () => {
        const plusTwo = await station.request(
          'EnterAttempt',
          attempt({ competitorId: CARD.c1, value: 1500, penalty: 2 }),
        );
        const dnf = await station.request(
          'EnterAttempt',
          attempt({ competitorId: CARD.c1, value: 1600, penalty: -1 }),
        );

        expect(plusTwo.data.status).toBe(200);
        expect(dnf.data.status).toBe(200);
        const attempts = await attemptsOf(c1.id, '333-r1');
        expect(
          attempts.map((a) => [a.attemptNumber, a.value, a.penalty]),
        ).toEqual([
          [1, 1234, 0],
          [2, 1500, 2],
          [3, 1600, -1],
        ]);
      });

      it('answers in the default locale when the judge is from another country', async () => {
        const res = await station.request(
          'EnterAttempt',
          attempt({ competitorId: CARD.c1, judgeId: CARD.foreignJudge }),
        );

        expect(res.data.message).toBe(
          getTranslation('attemptEntered', defaultLocale),
        );
        const attempts = await attemptsOf(c1.id, '333-r1');
        expect(attempts[3].judgeId).toBe(foreignJudge.id);
      });
    });

    describe('validation', () => {
      const expectNoAttemptFor = async (personId: string) => {
        expect(
          await db.attempt.count({ where: { result: { personId } } }),
        ).toBe(0);
      };

      it('rejects an unknown station', async () => {
        const res = await station.request(
          'EnterAttempt',
          attempt({ espId: ESP.unknown, competitorId: CARD.c4 }),
        );

        expect(res).toEqual(
          errorResponse(getTranslation('stationNotFound', defaultLocale), 404),
        );
        expect(res.data.shouldResetTime).toBe(false);
        await expectNoAttemptFor(c4.id);
      });

      it('rejects a station whose room has no current group', async () => {
        const res = await station.request(
          'EnterAttempt',
          attempt({ espId: ESP.stationEmpty, competitorId: CARD.c4 }),
        );

        expect(res).toEqual(
          errorResponse(getTranslation('noGroups', defaultLocale), 400),
        );
        await expectNoAttemptFor(c4.id);
      });

      it('rejects an unknown competitor card and asks to reset the time', async () => {
        const res = await station.request(
          'EnterAttempt',
          attempt({ competitorId: CARD.unknown }),
        );

        expect(res).toEqual(
          errorResponse(
            getTranslation('competitorNotFound', defaultLocale),
            404,
          ),
        );
        expect(res.data.shouldResetTime).toBe(true);
      });

      it('rejects an unknown judge card when no delegate was called', async () => {
        const res = await station.request(
          'EnterAttempt',
          attempt({ competitorId: CARD.c4, judgeId: CARD.unknown }),
        );

        expect(res).toEqual(
          errorResponse(getTranslation('judgeNotFound', defaultLocale), 404),
        );
        await expectNoAttemptFor(c4.id);
      });

      it('rejects a competitor judging themselves', async () => {
        const res = await station.request(
          'EnterAttempt',
          attempt({ competitorId: CARD.c4, judgeId: CARD.c4 }),
        );

        expect(res).toEqual(
          errorResponse(
            getTranslation('judgeIsCompetitor', defaultLocale),
            400,
          ),
        );
        await expectNoAttemptFor(c4.id);
      });

      it('requires a group id on a station whose room runs several groups', async () => {
        const res = await station.request(
          'EnterAttempt',
          attempt({ espId: ESP.stationB, competitorId: CARD.c4 }),
        );

        expect(res).toEqual(
          errorResponse(getTranslation('groupNotFound', defaultLocale), 400),
        );
        await expectNoAttemptFor(c4.id);
      });

      it('rejects a group that is not running in the station room', async () => {
        const res = await station.request(
          'EnterAttempt',
          attempt({
            espId: ESP.stationB,
            competitorId: CARD.c4,
            groupId: '333-r1-g1',
          }),
        );

        expect(res).toEqual(
          errorResponse(getTranslation('groupNotFound', defaultLocale), 404),
        );
        await expectNoAttemptFor(c4.id);
      });

      it('rejects a competitor not registered for the event', async () => {
        const notRegistered = await db.person.findFirst({
          where: { cardId: CARD.notRegistered.toString() },
        });
        const res = await station.request(
          'EnterAttempt',
          attempt({
            espId: ESP.stationB,
            competitorId: CARD.notRegistered,
            groupId: 'skewb-r1-g1',
          }),
        );

        expect(res).toEqual(
          errorResponse(
            getTranslation('competitorIsNotSignedInForEvent', 'pl'),
            400,
          ),
        );
        expect(
          await db.result.findFirst({
            where: { personId: notRegistered.id, roundId: 'skewb-r1' },
          }),
        ).toBeNull();
      });

      it('accepts a delegate call without a judge card', async () => {
        const data: Record<string, unknown> = attempt({
          competitorId: CARD.c4,
          isDelegate: true,
        });
        delete data.judgeId;
        try {
          const res = await station.request('EnterAttempt', data);

          expect(res.data.status).toBe(200);
          const attempts = await attemptsOf(c4.id, '333-r1');
          expect(attempts[0].status).toBe(AttemptStatus.UNRESOLVED);
        } finally {
          // Later tests expect c4 to have no result in 333-r1
          const where = { result: { personId: c4.id, roundId: '333-r1' } };
          await db.attemptEditLog.deleteMany({ where: { attempt: where } });
          await db.attempt.deleteMany({ where });
          await db.result.deleteMany({
            where: { personId: c4.id, roundId: '333-r1' },
          });
        }
      });
    });

    it('enters the attempt in the requested group of a multi-group room', async () => {
      const res = await station.request(
        'EnterAttempt',
        attempt({
          espId: ESP.stationB,
          competitorId: CARD.c1,
          groupId: 'skewb-r1-g1',
          value: 456,
        }),
      );

      expect(res.data.status).toBe(200);
      const attempts = await attemptsOf(c1.id, 'skewb-r1');
      expect(attempts).toHaveLength(1);
      expect(attempts[0].value).toBe(456);
    });

    it('turns an attempt over the time limit into a DNF', async () => {
      const res = await station.request(
        'EnterAttempt',
        attempt({ competitorId: CARD.c2, value: 60500 }),
      );

      expect(res.data).toMatchObject({
        message: getTranslation('attemptEnteredButReplacedToDnf', 'pl'),
        status: 200,
        error: false,
      });
      const [entered] = await attemptsOf(c2.id, '333-r1');
      expect(entered).toMatchObject({ value: 60500, penalty: -1 });
    });

    it('turns an attempt over the cumulative limit into a DNF and the rest into DNS', async () => {
      const bld = (value: number) =>
        attempt({
          espId: ESP.stationB,
          competitorId: CARD.c1,
          groupId: '333bf-r1-g1',
          value,
          inspectionTime: 0,
        });

      const first = await station.request('EnterAttempt', bld(35000));
      const second = await station.request('EnterAttempt', bld(30000));

      expect(first.data.message).toBe(getTranslation('attemptEntered', 'pl'));
      // The rest became DNS, so the round is over and its result comes along
      expect(second.data.message).toBe(
        `Best: 5:50.00 ${getTranslation('attemptEnteredButReplacedToDnf', 'pl')}`,
      );
      const attempts = await attemptsOf(c1.id, '333bf-r1');
      expect(attempts.map((a) => [a.attemptNumber, a.penalty])).toEqual([
        [1, 0],
        [2, -1],
        [3, -2],
        [4, -2],
        [5, -2],
      ]);
    });

    it('stops at the cutoff when the first attempts did not make it', async () => {
      const clock = (value: number) =>
        attempt({
          espId: ESP.stationB,
          competitorId: CARD.c2,
          groupId: 'clock-r1-g1',
          value,
        });

      // clock-r1: cutoff 20.00 after 2 attempts
      await station.request('EnterAttempt', clock(2500));
      const second = await station.request('EnterAttempt', clock(2600));
      const third = await station.request('EnterAttempt', clock(1000));

      expect(second.data.message).toBe(
        `Best: 25.00 ${getTranslation('attemptEntered', 'pl')}`,
      );
      expect(third).toEqual(
        errorResponse(getTranslation('cutoffNotPassed', 'pl'), 400),
      );
      expect(third.data.shouldResetTime).toBe(true);
      expect(await attemptsOf(c2.id, 'clock-r1')).toHaveLength(2);
    });

    it('fills in an attempt that was already scrambled', async () => {
      const result = await db.result.create({
        data: { personId: c3.id, roundId: '333-r1', eventId: '333' },
      });
      const scrambled = await db.attempt.create({
        data: {
          resultId: result.id,
          attemptNumber: 1,
          value: 0,
          penalty: 0,
          status: AttemptStatus.SCRAMBLED,
          type: AttemptType.STANDARD_ATTEMPT,
          scrambledAt: new Date(),
        },
      });

      const res = await station.request(
        'EnterAttempt',
        attempt({ competitorId: CARD.c3, value: 999 }),
      );

      expect(res.data.status).toBe(200);
      const attempts = await attemptsOf(c3.id, '333-r1');
      expect(attempts).toHaveLength(1);
      expect(attempts[0]).toMatchObject({
        id: scrambled.id,
        status: AttemptStatus.STANDARD,
        value: 999,
        deviceId: stationAId,
      });
    });

    it('enters an extra attempt when one was granted', async () => {
      const [original] = await attemptsOf(c3.id, '333-r1');
      await db.attempt.update({
        where: { id: original.id },
        data: { status: AttemptStatus.EXTRA_GIVEN, replacedBy: null },
      });

      const res = await station.request(
        'EnterAttempt',
        attempt({ competitorId: CARD.c3, value: 888 }),
      );

      expect(res.data.status).toBe(200);
      const attempts = await attemptsOf(c3.id, '333-r1');
      const extra = attempts.find((a) => a.type === AttemptType.EXTRA_ATTEMPT);
      expect(extra).toMatchObject({
        attemptNumber: 1,
        value: 888,
        status: AttemptStatus.STANDARD,
      });
      expect(attempts.find((a) => a.id === original.id).replacedBy).toBe(1);
    });

    it('refuses a sixth attempt in an average of 5 and tells the card scan there is nothing left', async () => {
      const result = await db.result.create({
        data: { personId: c4.id, roundId: '333-r1', eventId: '333' },
      });
      for (let i = 1; i <= 5; i++) {
        await db.attempt.create({
          data: {
            resultId: result.id,
            attemptNumber: i,
            value: 1000 + i,
            penalty: 0,
            status: AttemptStatus.STANDARD,
            type: AttemptType.STANDARD_ATTEMPT,
          },
        });
      }

      const res = await station.request(
        'EnterAttempt',
        attempt({ competitorId: CARD.c4 }),
      );
      const scan = await station.request('PersonInfo', {
        cardId: CARD.c4.toString(),
        espId: ESP.stationA,
        isCompetitor: true,
      });

      expect(res).toEqual(
        errorResponse(getTranslation('noAttemptsLeft', 'pl'), 400),
      );
      expect(await attemptsOf(c4.id, '333-r1')).toHaveLength(5);
      expect(scan).toEqual(
        errorResponse(getTranslation('noAttemptsLeft', 'PL'), 400),
      );
      expect(scan.data.shouldResetTime).toBe(true);
    });
  });

  describe('incidents (delegate called from the station)', () => {
    let incidentSession: string;
    let incidentAttemptId: string;

    it('creates an unresolved attempt and notifies the delegate', async () => {
      const data = attempt({ competitorId: CARD.c3, isDelegate: true });
      incidentSession = data.sessionId;
      // c3 already has an attempt + its extra; this is standard attempt 2
      const res = await station.request('EnterAttempt', data);

      expect(res).toMatchObject({
        type: 'EnterAttemptResp',
        data: {
          message: getTranslation('delegateWasNotified', 'pl'),
          status: 200,
          error: false,
        },
      });
      const unresolved = await db.attempt.findFirst({
        where: { sessionId: incidentSession, deviceId: stationAId },
      });
      expect(unresolved).toMatchObject({
        status: AttemptStatus.UNRESOLVED,
        attemptNumber: 2,
      });
      incidentAttemptId = unresolved.id;
    });

    it('tells the station when the delegate resolves the incident', async () => {
      const unresolved = await db.attempt.findUnique({
        where: { id: incidentAttemptId },
      });
      await request(app.getHttpServer())
        .put(`/attempt/${incidentAttemptId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          attemptNumber: unresolved.attemptNumber,
          status: AttemptStatus.RESOLVED,
          type: unresolved.type,
          penalty: 2,
          value: unresolved.value,
        })
        .expect(200);

      const msg = await station.waitForType('IncidentResolved');
      expect(msg.data).toMatchObject({
        espId: ESP.stationA,
        shouldScanCards: true,
        attempt: expect.objectContaining({
          id: incidentAttemptId,
          status: AttemptStatus.RESOLVED,
          penalty: 2,
        }),
      });
    });

    it('requires the judge card again before confirming the resolved attempt', async () => {
      const data: Record<string, unknown> = attempt({
        competitorId: CARD.c3,
        sessionId: incidentSession,
      });
      delete data.judgeId;

      const res = await station.request('EnterAttempt', data);

      expect(res).toEqual(
        errorResponse(
          getTranslation('judgeCardNotScanned', defaultLocale),
          400,
        ),
      );
    });

    it('confirms the resolved attempt with the judge who scanned', async () => {
      const res = await station.request(
        'EnterAttempt',
        attempt({
          competitorId: CARD.c3,
          sessionId: incidentSession,
          judgeId: CARD.foreignJudge,
        }),
      );

      expect(res).toMatchObject({
        type: 'EnterAttemptResp',
        data: {
          message: getTranslation('attemptEnteredAfterIncident', defaultLocale),
          status: 200,
          error: false,
        },
      });
      const confirmed = await db.attempt.findUnique({
        where: { id: incidentAttemptId },
      });
      expect(confirmed.judgeId).toBe(foreignJudge.id);
      expect(confirmed.status).toBe(AttemptStatus.RESOLVED);
    });

    it('tells the station not to scan cards when the delegate deletes the attempt', async () => {
      const data = attempt({ competitorId: CARD.c2, isDelegate: true });
      await station.request('EnterAttempt', data);
      const unresolved = await db.attempt.findFirst({
        where: { sessionId: data.sessionId },
      });

      await request(app.getHttpServer())
        .delete(`/attempt/${unresolved.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const msg = await station.waitForType('IncidentResolved');
      expect(msg.data).toMatchObject({
        espId: ESP.stationA,
        shouldScanCards: false,
        attempt: expect.objectContaining({ id: unresolved.id }),
      });
    });

    it('lets the delegate skip the card scan when resolving', async () => {
      const data = attempt({ competitorId: CARD.c2, isDelegate: true });
      await station.request('EnterAttempt', data);
      const unresolved = await db.attempt.findFirst({
        where: { sessionId: data.sessionId },
      });

      await request(app.getHttpServer())
        .put(`/attempt/${unresolved.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          attemptNumber: unresolved.attemptNumber,
          status: AttemptStatus.RESOLVED,
          type: unresolved.type,
          penalty: 0,
          value: unresolved.value,
          doNotRequireCards: true,
        })
        .expect(200);

      const msg = await station.waitForType('IncidentResolved');
      expect(msg.data.shouldScanCards).toBe(false);
      expect(msg.data.attempt.id).toBe(unresolved.id);
    });
  });

  describe('CreateAttendance (staff attendance devices)', () => {
    const activity = (personId: string, groupId: string, role: StaffRole) =>
      db.staffActivity.findUnique({
        where: { personId_groupId_role: { personId, groupId, role } },
      });

    it.each([
      [ESP.runnerAttendance, StaffRole.RUNNER],
      [ESP.scramblerAttendance, StaffRole.SCRAMBLER],
      [ESP.stationAttendance, StaffRole.JUDGE],
    ])(
      'marks the person present in every current group (device %s → %s)',
      async (espId, role) => {
        const res = await station.request('CreateAttendance', {
          cardId: CARD.judge,
          espId,
        });

        expect(res.type).toBe('CreateAttendanceResp');
        expect(res.data.message).toBe(
          getTranslation('attendanceConfirmed', judge.countryIso2),
        );
        for (const groupId of ['skewb-r1-g1', 'clock-r1-g1', '333bf-r1-g1']) {
          const row = await activity(judge.id, groupId, role);
          expect(row.status).toBe(StaffActivityStatus.PRESENT);
          expect(row.deviceId).toEqual(expect.any(String));
        }
      },
    );

    it('confirms without recording anything for an unknown device or card', async () => {
      const before = await db.staffActivity.count();

      const unknownDevice = await station.request('CreateAttendance', {
        cardId: CARD.judge,
        espId: ESP.unknown,
      });
      const unknownCard = await station.request('CreateAttendance', {
        cardId: CARD.unknown,
        espId: ESP.runnerAttendance,
      });

      expect(unknownDevice.type).toBe('CreateAttendanceResp');
      expect(unknownCard.type).toBe('CreateAttendanceResp');
      expect(await db.staffActivity.count()).toBe(before);
    });
  });

  describe('CurrentTimeInfo (live solving packets)', () => {
    it('acknowledges with an empty response', async () => {
      const res = await station.request('CurrentTimeInfo', {
        espId: ESP.stationA,
        time: 1234,
        inspection: 5000,
        competitor: CARD.c1,
        groupId: '333-r1-g1',
      });

      expect(res).toMatchObject({ type: 'EmptyResp', data: { error: false } });
    });
  });

  describe('messages pushed to stations by the backend', () => {
    let second: StationClient;

    beforeAll(async () => {
      second = await StationClient.connect(stationServer.path);
      await second.waitForType('ServerStatus');
      station.clear();
    });

    afterAll(() => second?.close());

    it('broadcasts the new server status when a device is registered and removed', async () => {
      const created = await request(app.getHttpServer())
        .post('/device')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'e2e-rt-station-http',
          espId: ESP.requested,
          signKey: ESP.requested,
          roomId: roomAId,
          type: 'STATION',
          hwVersion: HardwareVersion.V4,
        })
        .expect(201);

      const hasDevice = (m: any) =>
        m.type === 'ServerStatus' &&
        m.data.devices.some((d: any) => d.espId === ESP.requested);
      await station.waitFor(hasDevice);
      await second.waitFor(hasDevice);

      await request(app.getHttpServer())
        .delete(`/device/${created.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      const lacksDevice = (m: any) =>
        m.type === 'ServerStatus' &&
        !m.data.devices.some((d: any) => d.espId === ESP.requested);
      await station.waitFor(lacksDevice);
      await second.waitFor(lacksDevice);
    });

    it('broadcasts the server status when the current groups change', async () => {
      station.clear();
      await request(app.getHttpServer())
        .put('/competition/rooms')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ rooms: [{ id: roomBId, currentGroupIds: ['skewb-r1-g1'] }] })
        .expect(200);

      const status = await station.waitForType('ServerStatus');
      expect(status.data.devices).toEqual(expect.any(Array));
      expect(
        (await db.room.findUnique({ where: { id: roomBId } })).currentGroupIds,
      ).toEqual(['skewb-r1-g1']);
    });

    it('sends uploaded firmware to every connected station', async () => {
      await request(app.getHttpServer())
        .post('/device/upload-firmware')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ fileName: 'station-e2e.bin', fileData: 'AAECAw==' })
        .expect(200);

      const expected = {
        type: 'UploadFirmware',
        data: { fileName: 'station-e2e.bin', fileData: 'AAECAw==' },
      };
      expect(await station.waitForType('UploadFirmware')).toEqual(expected);
      expect(await second.waitForType('UploadFirmware')).toEqual(expected);
    });

    it('rejects firmware file names with path components', async () => {
      await request(app.getHttpServer())
        .post('/device/upload-firmware')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ fileName: '../evil.bin', fileData: 'AA==' })
        .expect(400);
    });

    it('broadcasts the server status when the devices settings change', async () => {
      const competition = await db.competition.findFirst();
      const original = {
        shouldUpdateDevices: competition.shouldUpdateDevices,
        wifiSsid: competition.wifiSsid,
        wifiPassword: competition.wifiPassword,
        mdns: competition.mdns,
        wsUrl: competition.wsUrl,
        defaultLocale: competition.defaultLocale,
        secureRfid: competition.secureRfid,
        soundEnabled: competition.soundEnabled,
        hilTesting: false,
      };
      try {
        await request(app.getHttpServer())
          .put(`/competition/settings/${competition.id}/devices`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ ...original, soundEnabled: !original.soundEnabled })
          .expect(200);

        await station.waitFor(
          (m) =>
            m.type === 'ServerStatus' &&
            m.data.soundEnabled === !original.soundEnabled,
        );
      } finally {
        await request(app.getHttpServer())
          .put(`/competition/settings/${competition.id}/devices`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(original)
          .expect(200);
      }
      await station.waitFor(
        (m) =>
          m.type === 'ServerStatus' &&
          m.data.soundEnabled === original.soundEnabled,
      );
    });
  });

  describe('hardware-in-the-loop testing mode', () => {
    let competitionId: string;
    let settings: Record<string, unknown>;

    const setHil = (hilTesting: boolean) =>
      request(app.getHttpServer())
        .put(`/competition/settings/${competitionId}/devices`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...settings, hilTesting })
        .expect(200);

    const waitForHil = async (expected: boolean) => {
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        const res = await request(app.getHttpServer())
          .get('/competition/settings')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
        if (res.body.hilTesting === expected) return;
        await new Promise((r) => setTimeout(r, 20));
      }
      throw new Error(`hilTesting never became ${expected}`);
    };

    beforeAll(async () => {
      const competition = await db.competition.findFirst();
      competitionId = competition.id;
      settings = {
        shouldUpdateDevices: competition.shouldUpdateDevices,
        wifiSsid: competition.wifiSsid,
        wifiPassword: competition.wifiPassword,
        mdns: competition.mdns,
        wsUrl: competition.wsUrl,
        defaultLocale: competition.defaultLocale,
        secureRfid: competition.secureRfid,
        soundEnabled: competition.soundEnabled,
      };
    });

    afterAll(async () => {
      await setHil(false);
    });

    it('hands station packets to the HIL processor instead of answering them, until switched off', async () => {
      await setHil(true);
      await waitForHil(true);

      // Spy on the HIL processor to know for sure the packet reached it
      const hil = stationServer.socketServer.hilProcessor;
      const fed: string[] = [];
      const feed = hil.feed_packet.bind(hil);
      hil.feed_packet = (packet: string) => {
        fed.push(packet);
        feed(packet);
      };
      const swallowedTag = station.send('ServerStatus', {});
      const deadline = Date.now() + 5000;
      while (!fed.some((p) => JSON.parse(p).tag === swallowedTag)) {
        if (Date.now() > deadline) throw new Error('packet never reached HIL');
        await new Promise((r) => setTimeout(r, 10));
      }

      await setHil(false);
      await waitForHil(false);

      const res = await station.request('ServerStatus', {});
      expect(res.type).toBe('ServerStatusResp');
      expect(station.pending().some((m) => m.tag === swallowedTag)).toBe(false);
    });
  });
});
