import {
  SIGNAL_EMIT_INTERVAL_MS,
  SIGNAL_STALE_MS,
  StationSignalService,
} from './stationSignal.service';

describe('StationSignalService', () => {
  const espId = 4242;
  let appGateway: { handleDeviceSignal: jest.Mock };
  let service: StationSignalService;

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-05-02T09:00:00Z') });
    appGateway = { handleDeviceSignal: jest.fn() };
    service = new StationSignalService(appGateway as never);
    service.onModuleInit();
  });

  afterEach(() => {
    service.onModuleDestroy();
    jest.useRealTimers();
  });

  /** One reading per second, like a station during a solve */
  const readings = (...values: number[]) => {
    for (const value of values) {
      service.recordRssi(espId, value);
      jest.advanceTimersByTime(1000);
    }
  };

  const link = (apSignal: number | null, overrides = {}) =>
    service.recordLink({
      espId,
      apSignal,
      txBitrateKbps: 6000,
      txRetriesPercent: 120,
      ...overrides,
    });

  describe('level', () => {
    it('is unknown before the first reading', () => {
      expect(service.getSignal(espId)).toEqual({
        level: 'unknown',
        rssi: null,
        link: null,
        reportedRssi: false,
      });
    });

    it('is the median of the last 5 readings', () => {
      readings(-40, -41, -90, -42, -43, -44);

      // -90 is still in the window, but one bad reading doesn't count
      expect(service.getSignal(espId)).toMatchObject({
        level: 'ok',
        rssi: -43,
        reportedRssi: true,
      });
    });

    it('turns weak once the median reaches -63 dBm', () => {
      readings(-62, -62, -62);
      expect(service.getSignal(espId).level).toBe('ok');

      readings(-63, -63, -63);
      expect(service.getSignal(espId)).toMatchObject({
        level: 'weak',
        rssi: -63,
      });
    });

    it('stays weak until the median is above -59 dBm', () => {
      readings(-66, -66, -66, -66, -66);
      expect(service.getSignal(espId).level).toBe('weak');

      readings(-60, -60, -60, -60, -60);
      expect(service.getSignal(espId)).toMatchObject({
        level: 'weak',
        rssi: -60,
      });

      readings(-58, -58, -58);
      expect(service.getSignal(espId)).toMatchObject({
        level: 'ok',
        rssi: -58,
      });
    });

    it("doesn't flicker for a station sitting at the threshold", () => {
      readings(-63, -63, -63);
      expect(service.getSignal(espId).level).toBe('weak');

      readings(-61, -62, -63, -61, -62, -63, -61, -62);
      expect(service.getSignal(espId).level).toBe('weak');
    });

    it('goes unknown 30 s after the last reading', () => {
      readings(-50);
      jest.advanceTimersByTime(SIGNAL_STALE_MS - 2000);
      expect(service.getSignal(espId).level).toBe('ok');

      jest.advanceTimersByTime(1000);
      expect(service.getSignal(espId)).toEqual({
        level: 'unknown',
        rssi: null,
        link: null,
        // Tells "waiting for the station" from "needs newer firmware"
        reportedRssi: true,
      });
    });

    it('starts over after a gap instead of mixing in old readings', () => {
      readings(-70, -70, -70, -70, -70);
      jest.advanceTimersByTime(SIGNAL_STALE_MS);
      readings(-50);

      expect(service.getSignal(espId)).toMatchObject({
        level: 'ok',
        rssi: -50,
      });
    });

    it('ignores 0 and anything else that is not a reading', () => {
      service.recordRssi(espId, 0);
      service.recordRssi(espId, null);
      service.recordRssi(espId, 'strong');

      expect(service.getSignal(espId).level).toBe('unknown');
      expect(appGateway.handleDeviceSignal).not.toHaveBeenCalled();
    });
  });

  describe('router side (StationLink)', () => {
    it('keeps the latest link details', () => {
      link(-68, { txBitrateKbps: 1000, txRetriesPercent: 80 });
      link(-70);

      expect(service.getSignal(espId).link).toEqual({
        apSignal: -70,
        txBitrateKbps: 6000,
        txRetriesPercent: 120,
      });
    });

    it('takes the level from the access point for a station without its own RSSI', () => {
      link(-66);
      jest.advanceTimersByTime(10_000);
      link(-66);

      expect(service.getSignal(espId)).toMatchObject({
        level: 'weak',
        rssi: -66,
        reportedRssi: false,
      });
    });

    it("prefers the station's own reading over the access point's", () => {
      link(-70);
      readings(-50);

      expect(service.getSignal(espId)).toMatchObject({
        level: 'ok',
        rssi: -50,
        link: expect.objectContaining({ apSignal: -70 }),
      });
    });

    it('drops the link 30 s after the last StationLink', () => {
      link(-60);
      jest.advanceTimersByTime(SIGNAL_STALE_MS - 1);
      expect(service.getSignal(espId).link).not.toBeNull();

      jest.advanceTimersByTime(1);
      expect(service.getSignal(espId)).toMatchObject({
        level: 'unknown',
        link: null,
      });
    });

    it('keeps the link when the access point has no signal reading', () => {
      link(null);

      expect(service.getSignal(espId)).toMatchObject({
        level: 'unknown',
        link: { apSignal: null, txBitrateKbps: 6000, txRetriesPercent: 120 },
      });
    });
  });

  describe('deviceSignal', () => {
    const emittedLevels = () =>
      appGateway.handleDeviceSignal.mock.calls.map(([event]) => event.level);

    it('goes out with the first reading', () => {
      readings(-50);

      expect(appGateway.handleDeviceSignal).toHaveBeenCalledWith({
        espId,
        level: 'ok',
        rssi: -50,
        link: null,
        reportedRssi: true,
      });
    });

    it('goes out on a level change, not on every packet', () => {
      readings(-50, -50, -50, -50);
      expect(appGateway.handleDeviceSignal).toHaveBeenCalledTimes(1);

      readings(-70, -70, -70);
      expect(emittedLevels()).toEqual(['ok', 'weak']);
    });

    it('goes out at most every 10 s while the level holds', () => {
      for (let i = 0; i < 25; i++) {
        service.recordRssi(espId, -50 - (i % 3));
        jest.advanceTimersByTime(1000);
      }

      // At 0 s, 10 s and 20 s
      expect(appGateway.handleDeviceSignal).toHaveBeenCalledTimes(3);
      expect(SIGNAL_EMIT_INTERVAL_MS).toBe(10_000);
    });

    it('goes out when a station stops reporting, without a packet', () => {
      readings(-50);
      jest.advanceTimersByTime(SIGNAL_STALE_MS + 5000);

      expect(emittedLevels()).toEqual(['ok', 'unknown']);
      jest.advanceTimersByTime(60_000);
      expect(appGateway.handleDeviceSignal).toHaveBeenCalledTimes(2);
    });
  });
});
