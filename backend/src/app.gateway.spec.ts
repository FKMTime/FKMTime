import { AppGateway } from './app.gateway';

describe('AppGateway device requests', () => {
  let gateway: AppGateway;
  let emit: jest.Mock;

  const request = (signKey: number, espId = 1001) => ({
    espId,
    signKey,
    type: 'STATION' as any,
    hw: 'V3',
  });

  beforeEach(() => {
    gateway = new AppGateway();
    emit = jest.fn();
    gateway.server = { to: jest.fn(() => ({ emit })) } as any;
  });

  it('keeps one request when a device asks again with the same details', () => {
    gateway.handleDeviceRequest(request(11));
    gateway.handleDeviceRequest(request(11));

    expect(gateway.deviceRequests).toEqual([request(11)]);
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it('replaces a pending request when the device asks again with a new sign key', () => {
    gateway.handleDeviceRequest(request(11));
    gateway.handleDeviceRequest(request(22));

    expect(gateway.deviceRequests).toEqual([request(22)]);
    expect(emit).toHaveBeenLastCalledWith('deviceRequests', [request(22)]);
  });

  it('leaves requests from other devices untouched', () => {
    gateway.handleDeviceRequest(request(11, 1001));
    gateway.handleDeviceRequest(request(33, 2002));
    gateway.handleDeviceRequest(request(22, 1001));

    expect(gateway.deviceRequests).toEqual([
      request(33, 2002),
      request(22, 1001),
    ]);
  });
});

describe('AppGateway last solve', () => {
  let gateway: AppGateway;
  let emit: jest.Mock;

  const packet = (espId: number) => ({
    espId,
    deviceName: `Station ${espId}`,
    roomId: 'room-1',
    personName: null,
    registrantId: null,
    groupId: null,
    time: null,
    inspection: null,
    timerRunning: null,
    inspectionRunning: null,
    cumulativeLimitCentiseconds: null,
    cumulativeRemainingCentiseconds: null,
    serverReceivedAt: 1000,
  });
  const lastSolve = {
    personName: 'Ada Example',
    value: 1234,
    penalty: 2,
    enteredAt: 5000,
  };

  beforeEach(() => {
    gateway = new AppGateway();
    emit = jest.fn();
    gateway.server = { to: jest.fn(() => ({ emit })) } as any;
  });

  it('sends a station without a last solve until one is entered', () => {
    gateway.broadcastCurrentTimeInfo(packet(1));

    expect(emit).toHaveBeenLastCalledWith('currentTimeInfo', {
      ...packet(1),
      lastSolve: null,
    });
  });

  it('re-sends a known station as soon as its solve is entered', () => {
    gateway.broadcastCurrentTimeInfo(packet(1));
    gateway.recordLastSolve(1, lastSolve);

    expect(emit).toHaveBeenLastCalledWith('currentTimeInfo', {
      ...packet(1),
      lastSolve,
    });
  });

  it('keeps the last solve on later packets', () => {
    gateway.recordLastSolve(1, lastSolve);
    gateway.broadcastCurrentTimeInfo(packet(1));

    expect(emit).toHaveBeenLastCalledWith('currentTimeInfo', {
      ...packet(1),
      lastSolve,
    });
  });

  it('only stores the solve of a station not heard from yet', () => {
    gateway.recordLastSolve(2, lastSolve);

    expect(emit).not.toHaveBeenCalled();
  });
});
