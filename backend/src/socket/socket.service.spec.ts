import { DeviceType } from '@prisma/client';

import { CompetitionService } from '../competition/competition.service';
import { DeviceService } from '../device/device.service';
import { StationSignalService } from '../device/stationSignal.service';
import { PersonService } from '../person/person.service';
import { LIVE_LOOKUP_TTL_MS } from '../ttl-cache';
import { SocketService } from './socket.service';

describe('SocketService', () => {
  describe('handleCurrentTimeInfo', () => {
    const now = new Date('2026-03-14T10:00:00Z').getTime();
    const station = {
      id: 'device-1',
      name: 'Station A',
      espId: 7,
      type: DeviceType.STATION,
      roomId: 'room-1',
    };
    const person = { id: 'person-1', name: 'Alex Example', registrantId: 12 };
    const wcif = {
      events: [
        {
          id: '333bf',
          rounds: [
            {
              id: '333bf-r1',
              timeLimit: {
                centiseconds: 60000,
                cumulativeRoundIds: ['333bf-r1'],
              },
            },
          ],
        },
      ],
    };
    const update = {
      espId: 7,
      time: 1234,
      inspection: 5000,
      competitor: 4242,
      groupId: '333bf-r1-g1',
    };

    let prisma: {
      device: Record<string, jest.Mock>;
      attempt: Record<string, jest.Mock>;
      staffActivity: Record<string, jest.Mock>;
      attemptEditLog: Record<string, jest.Mock>;
      person: Record<string, jest.Mock>;
      competition: Record<string, jest.Mock>;
    };
    let resultService: { getCumulativeSumForMultipleRounds: jest.Mock };
    let resultFromDeviceService: { enterAttempt: jest.Mock };
    let appGateway: Record<string, jest.Mock>;
    let deviceService: DeviceService;
    let stationSignal: StationSignalService;
    let personService: PersonService;
    let competitionService: CompetitionService;
    let service: SocketService;

    beforeEach(() => {
      jest.useFakeTimers({ now });
      prisma = {
        device: {
          findFirst: jest.fn().mockResolvedValue(station),
          update: jest.fn().mockResolvedValue({}),
          delete: jest.fn().mockResolvedValue({}),
        },
        attempt: { count: jest.fn().mockResolvedValue(0) },
        staffActivity: { count: jest.fn().mockResolvedValue(0) },
        attemptEditLog: { count: jest.fn().mockResolvedValue(0) },
        person: {
          findFirst: jest.fn().mockResolvedValue(person),
          update: jest.fn().mockResolvedValue({}),
        },
        competition: { findFirst: jest.fn().mockResolvedValue({ wcif }) },
      };
      resultService = {
        getCumulativeSumForMultipleRounds: jest.fn().mockResolvedValue(15000),
      };
      resultFromDeviceService = {
        enterAttempt: jest.fn().mockResolvedValue({}),
      };
      appGateway = {
        broadcastCurrentTimeInfo: jest.fn(),
        handleDeviceUpdated: jest.fn(),
        handleDeviceSignal: jest.fn(),
      };
      const socketController = { sendServerStatus: jest.fn() };
      stationSignal = new StationSignalService(appGateway as never);
      deviceService = new DeviceService(
        prisma as never,
        appGateway as never,
        socketController as never,
        stationSignal,
      );
      personService = new PersonService(prisma as never, {} as never);
      competitionService = new CompetitionService(
        prisma as never,
        appGateway as never,
        resultService as never,
        {} as never,
        socketController as never,
        null,
      );
      service = new SocketService(
        resultService as never,
        resultFromDeviceService as never,
        deviceService,
        {} as never,
        competitionService,
        {} as never,
        personService,
        appGateway as never,
        stationSignal,
      );
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    const lookups = () => ({
      device: prisma.device.findFirst.mock.calls.length,
      person: prisma.person.findFirst.mock.calls.length,
      competition: prisma.competition.findFirst.mock.calls.length,
      cumulative:
        resultService.getCumulativeSumForMultipleRounds.mock.calls.length,
    });

    it('broadcasts the same payload as before', async () => {
      await service.handleCurrentTimeInfo(update);

      expect(appGateway.broadcastCurrentTimeInfo).toHaveBeenCalledWith({
        espId: 7,
        deviceName: 'Station A',
        roomId: 'room-1',
        personName: 'Alex Example',
        registrantId: 12,
        groupId: '333bf-r1-g1',
        time: 1234,
        inspection: 5000,
        timerRunning: null,
        inspectionRunning: null,
        cumulativeLimitCentiseconds: 60000,
        cumulativeRemainingCentiseconds: 45000,
        serverReceivedAt: now,
      });
      expect(prisma.device.findFirst).toHaveBeenCalledWith({
        where: { espId: 7, type: DeviceType.STATION, retiredAt: null },
        include: { room: true },
      });
      expect(
        resultService.getCumulativeSumForMultipleRounds,
      ).toHaveBeenCalledWith('person-1', ['333bf-r1']);
    });

    it('forwards the running flags the station reports', async () => {
      await service.handleCurrentTimeInfo({
        ...update,
        timerRunning: true,
        inspectionRunning: false,
      });

      expect(appGateway.broadcastCurrentTimeInfo).toHaveBeenCalledWith(
        expect.objectContaining({
          espId: 7,
          time: 1234,
          timerRunning: true,
          inspectionRunning: false,
        }),
      );
    });

    it('sends null flags for firmware that does not report them', async () => {
      await service.handleCurrentTimeInfo({ espId: 7, time: 4200 });

      expect(appGateway.broadcastCurrentTimeInfo).toHaveBeenCalledWith(
        expect.objectContaining({
          timerRunning: null,
          inspectionRunning: null,
        }),
      );
    });

    it("passes the station's RSSI to the signal service", async () => {
      await service.handleCurrentTimeInfo({ ...update, rssi: -66 });

      expect(stationSignal.getSignal(7)).toMatchObject({
        level: 'weak',
        rssi: -66,
      });
      expect(appGateway.handleDeviceSignal).toHaveBeenCalledWith(
        expect.objectContaining({ espId: 7, level: 'weak', rssi: -66 }),
      );
    });

    it('leaves the signal unknown without an RSSI or with null', async () => {
      await service.handleCurrentTimeInfo(update);
      await service.handleCurrentTimeInfo({ ...update, rssi: null });

      expect(stationSignal.getSignal(7)).toMatchObject({
        level: 'unknown',
        reportedRssi: false,
      });
      expect(appGateway.handleDeviceSignal).not.toHaveBeenCalled();
    });

    it('passes StationLink to the signal service', () => {
      service.handleStationLink({
        espId: 7,
        apSignal: -68,
        txBitrateKbps: 6000,
        txRetriesPercent: 120,
      });

      expect(stationSignal.getSignal(7)).toMatchObject({
        level: 'weak',
        rssi: -68,
        link: { apSignal: -68, txBitrateKbps: 6000, txRetriesPercent: 120 },
      });
    });

    it('reads each cached lookup once for repeated updates within the TTL', async () => {
      for (let i = 0; i < 5; i++) {
        await service.handleCurrentTimeInfo({ ...update, time: 1000 + i });
        jest.advanceTimersByTime(LIVE_LOOKUP_TTL_MS / 10);
      }

      expect(lookups()).toEqual({
        device: 1,
        person: 1,
        competition: 1,
        cumulative: 5,
      });
      expect(appGateway.broadcastCurrentTimeInfo).toHaveBeenCalledTimes(5);
      expect(
        appGateway.broadcastCurrentTimeInfo.mock.calls.map(
          ([info]) => info.time,
        ),
      ).toEqual([1000, 1001, 1002, 1003, 1004]);
    });

    it('reads again once the TTL has passed', async () => {
      await service.handleCurrentTimeInfo(update);
      jest.advanceTimersByTime(LIVE_LOOKUP_TTL_MS);
      await service.handleCurrentTimeInfo(update);

      expect(lookups()).toEqual({
        device: 2,
        person: 2,
        competition: 2,
        cumulative: 2,
      });
    });

    it('shows a renamed station under its new name straight away', async () => {
      await service.handleCurrentTimeInfo(update);
      prisma.device.findFirst.mockResolvedValue({
        ...station,
        name: 'Station B',
      });
      await deviceService.updateDevice(station.id, {
        ...station,
        name: 'Station B',
      } as never);
      await service.handleCurrentTimeInfo(update);

      expect(prisma.device.findFirst).toHaveBeenCalledTimes(2);
      expect(
        appGateway.broadcastCurrentTimeInfo.mock.calls.map(
          ([info]) => info.deviceName,
        ),
      ).toEqual(['Station A', 'Station B']);
    });

    it('falls back to the default name once a station is deleted', async () => {
      await service.handleCurrentTimeInfo(update);
      prisma.device.findFirst.mockResolvedValue(null);
      await deviceService.deleteDevice(station.id);
      await service.handleCurrentTimeInfo(update);

      expect(appGateway.broadcastCurrentTimeInfo).toHaveBeenLastCalledWith(
        expect.objectContaining({ deviceName: 'Station 7', roomId: null }),
      );
    });

    it('looks the card up again after a card is reassigned', async () => {
      await service.handleCurrentTimeInfo(update);
      prisma.person.findFirst.mockResolvedValue(null);
      await personService.updatePerson(person.id, { cardId: null } as never);
      await service.handleCurrentTimeInfo(update);

      expect(lookups().person).toBe(2);
      expect(appGateway.broadcastCurrentTimeInfo).toHaveBeenLastCalledWith(
        expect.objectContaining({
          personName: null,
          registrantId: null,
          cumulativeLimitCentiseconds: null,
        }),
      );
    });

    it('reads the WCIF again after it is synced', async () => {
      await service.handleCurrentTimeInfo(update);
      competitionService.invalidateWcifCache();
      await service.handleCurrentTimeInfo(update);

      expect(lookups().competition).toBe(2);
    });

    it('shows the remaining cumulative time as of each update', async () => {
      await service.handleCurrentTimeInfo(update);
      resultService.getCumulativeSumForMultipleRounds.mockResolvedValue(20000);
      await service.handleCurrentTimeInfo(update);

      expect(lookups().cumulative).toBe(2);
      expect(appGateway.broadcastCurrentTimeInfo).toHaveBeenLastCalledWith(
        expect.objectContaining({ cumulativeRemainingCentiseconds: 40000 }),
      );
    });
  });
});
