import { SocketService } from './socket.service';

describe('SocketService current time info', () => {
  let service: SocketService;
  let broadcast: jest.Mock;

  beforeEach(() => {
    broadcast = jest.fn();
    const deviceService = {
      getDeviceByEspId: jest.fn().mockResolvedValue(null),
    };
    service = new SocketService(
      {} as any,
      {} as any,
      deviceService as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { broadcastCurrentTimeInfo: broadcast } as any,
    );
  });

  it('forwards the running flags the station reports', async () => {
    await service.handleCurrentTimeInfo({
      espId: 1001,
      time: 4200,
      inspection: 9000,
      timerRunning: true,
      inspectionRunning: false,
    });

    expect(broadcast).toHaveBeenCalledWith(
      expect.objectContaining({
        espId: 1001,
        time: 4200,
        timerRunning: true,
        inspectionRunning: false,
      }),
    );
  });

  it('sends null flags for firmware that does not report them', async () => {
    await service.handleCurrentTimeInfo({ espId: 1001, time: 4200 });

    expect(broadcast).toHaveBeenCalledWith(
      expect.objectContaining({
        timerRunning: null,
        inspectionRunning: null,
      }),
    );
  });
});
