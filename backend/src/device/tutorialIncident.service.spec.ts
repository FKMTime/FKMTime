import { HttpException } from '@nestjs/common';
import { AttemptStatus } from '@prisma/client';

import {
  TUTORIAL_INCIDENT_TTL_MS,
  TutorialIncidentCall,
  TutorialIncidentService,
} from './tutorialIncident.service';

describe('TutorialIncidentService (SPEC-012)', () => {
  let socketController: { sendResponseToAllSockets: jest.Mock };
  let appGateway: {
    handleNewIncident: jest.Mock;
    handleIncidentsChanged: jest.Mock;
  };
  let service: TutorialIncidentService;

  const call = (
    overrides: Partial<TutorialIncidentCall> = {},
  ): TutorialIncidentCall => ({
    espId: 7,
    deviceName: 'Station 7',
    roomId: 'room-1',
    competitorName: 'Ada Example',
    judgeName: 'Ben Example',
    value: 1234,
    penalty: 0,
    inspectionTime: 8000,
    sessionId: 'session-1',
    ...overrides,
  });
  const sent = () =>
    socketController.sendResponseToAllSockets.mock.calls.map(([r]) => r);

  beforeEach(() => {
    jest.useFakeTimers();
    socketController = { sendResponseToAllSockets: jest.fn() };
    appGateway = {
      handleNewIncident: jest.fn(),
      handleIncidentsChanged: jest.fn(),
    };
    service = new TutorialIncidentService(
      socketController as never,
      appGateway as never,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps a call and tells delegates it is a tutorial one', () => {
    const incident = service.record(call());

    expect(service.getAll()).toEqual([incident]);
    expect(service.count()).toBe(1);
    expect(appGateway.handleNewIncident).toHaveBeenCalledWith(
      'Station 7',
      'Ada Example',
      incident.id,
      true,
    );
  });

  it('keeps one entry for a call resent with the same session', () => {
    const first = service.record(call());
    const again = service.record(call({ value: 999 }));

    expect(again).toBe(first);
    expect(service.count()).toBe(1);
    expect(appGateway.handleNewIncident).toHaveBeenCalledTimes(1);
  });

  it('answers the station with the decided time and asks for the cards', () => {
    const { id } = service.record(call());

    service.resolve(id, {
      value: 1500,
      penalty: 2,
      status: AttemptStatus.RESOLVED,
    });

    expect(sent()).toEqual([
      {
        type: 'IncidentResolved',
        data: {
          espId: 7,
          shouldScanCards: true,
          attempt: { sessionId: 'session-1', value: 1500, penalty: 2 },
        },
      },
    ]);
    expect(service.count()).toBe(0);
    expect(appGateway.handleIncidentsChanged).toHaveBeenCalled();
  });

  it("doesn't ask for the cards when the delegate says not to", () => {
    const { id } = service.record(call());

    service.resolve(id, {
      value: 1500,
      penalty: 0,
      status: AttemptStatus.RESOLVED,
      doNotRequireCards: true,
    });

    expect(sent()[0].data.shouldScanCards).toBe(false);
  });

  it('ends the attempt on an extra, with the time the station sent', () => {
    const { id } = service.record(call());

    service.resolve(id, {
      value: 1,
      penalty: 0,
      status: AttemptStatus.EXTRA_GIVEN,
    });

    expect(sent()[0].data).toEqual({
      espId: 7,
      shouldScanCards: false,
      attempt: { sessionId: 'session-1', value: 1234, penalty: 0 },
    });
  });

  it('ends the attempt when deleted', () => {
    const { id } = service.record(call());

    service.remove(id);

    expect(sent()[0].data.shouldScanCards).toBe(false);
    expect(service.count()).toBe(0);
  });

  it('drops a call once the station stopped waiting, and says so', () => {
    const { id } = service.record(call());

    jest.advanceTimersByTime(TUTORIAL_INCIDENT_TTL_MS);

    expect(service.count()).toBe(0);
    expect(appGateway.handleIncidentsChanged).toHaveBeenCalled();
    expect(() => service.remove(id)).toThrow(HttpException);
    expect(sent()).toEqual([]);
  });

  it("drops a deleted station's calls", () => {
    service.record(call());
    service.record(call({ espId: 8, sessionId: 'session-2' }));

    service.forgetStation(7);

    expect(service.getAll().map((i) => i.espId)).toEqual([8]);
  });
});
