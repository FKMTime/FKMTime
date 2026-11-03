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
