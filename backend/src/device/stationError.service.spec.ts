import {
  STATION_ERROR_TTL_MS,
  StationErrorService,
} from './stationError.service';

describe('StationErrorService', () => {
  let appGateway: { handleDeviceError: jest.Mock };
  let service: StationErrorService;

  const error = (key: string, extra: object = {}) => ({
    message: `text for ${key}`,
    shouldResetTime: false,
    status: 400,
    error: true,
    errorDetails: { key, ...extra },
  });

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-03-01T10:00:00Z') });
    appGateway = { handleDeviceError: jest.fn() };
    service = new StationErrorService(appGateway as never);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps the error with its kind, message, card and competitor', () => {
    service.handleReply(
      1,
      error('competitorNotFound', { cardId: 3004, competitorName: null }),
    );

    expect(service.getLastError(1)).toEqual({
      key: 'competitorNotFound',
      kind: 'problem',
      message: 'text for competitorNotFound',
      at: '2026-03-01T10:00:00.000Z',
      count: 1,
      cardId: '3004',
      competitorName: null,
    });
  });

  it('calls the rules working as intended a rule, not a problem', () => {
    service.handleReply(1, error('cutoffNotPassed', { competitorName: 'Ada' }));

    expect(service.getLastError(1)).toMatchObject({
      kind: 'rule',
      competitorName: 'Ada',
    });
  });

  it('counts the same error in a row, and starts again on another', () => {
    service.handleReply(1, error('judgeNotFound'));
    service.handleReply(1, error('judgeNotFound'));
    expect(service.getLastError(1)?.count).toBe(2);

    service.handleReply(1, error('judgeIsCompetitor'));
    expect(service.getLastError(1)?.count).toBe(1);
  });

  it('removes the details from the reply the station gets', () => {
    const reply = service.handleReply(1, error('noGroups'));

    expect(reply).toEqual({
      message: 'text for noGroups',
      shouldResetTime: false,
      status: 400,
      error: true,
    });
  });

  it('clears the error on a successful reply', () => {
    service.handleReply(1, error('noGroups'));
    service.handleReply(1, { message: 'Attempt entered', status: 200 });

    expect(service.getLastError(1)).toBeNull();
    expect(appGateway.handleDeviceError).toHaveBeenLastCalledWith({
      espId: 1,
      lastError: null,
    });
  });

  it('treats an unchanged resent solve as a success', () => {
    service.handleReply(1, error('noGroups'));
    service.handleReply(1, {
      ...error('attemptAlreadyEntered'),
      shouldResetTime: true,
    });

    expect(service.getLastError(1)).toBeNull();
  });

  it('records a resent solve that differs from the saved one', () => {
    service.handleReply(1, error('attemptAlreadyEntered'));

    expect(service.getLastError(1)).toMatchObject({
      key: 'attemptAlreadyEntered',
      kind: 'rule',
    });
  });

  it('sends no event when a station without an error succeeds', () => {
    service.handleReply(1, { message: 'Attempt entered' });

    expect(appGateway.handleDeviceError).not.toHaveBeenCalled();
  });

  it('keeps stations apart', () => {
    service.handleReply(1, error('noGroups'));
    service.handleReply(2, { message: 'Attempt entered' });

    expect(service.getLastError(1)?.key).toBe('noGroups');
    expect(service.getLastError(2)).toBeNull();
  });

  it('drops an error after 10 minutes and says so', () => {
    service.handleReply(1, error('noGroups'));

    jest.advanceTimersByTime(STATION_ERROR_TTL_MS - 1);
    service.dropExpired();
    expect(service.getLastError(1)).not.toBeNull();

    jest.advanceTimersByTime(1);
    expect(service.getLastError(1)).toBeNull();
    service.dropExpired();
    expect(appGateway.handleDeviceError).toHaveBeenLastCalledWith({
      espId: 1,
      lastError: null,
    });
  });

  it('starts counting again once an error expired', () => {
    service.handleReply(1, error('noGroups'));
    jest.advanceTimersByTime(STATION_ERROR_TTL_MS);
    service.handleReply(1, error('noGroups'));

    expect(service.getLastError(1)?.count).toBe(1);
  });

  it('forgets a deleted station without an event', () => {
    service.handleReply(1, error('noGroups'));
    appGateway.handleDeviceError.mockClear();

    service.forget(1);

    expect(service.getLastError(1)).toBeNull();
    expect(appGateway.handleDeviceError).not.toHaveBeenCalled();
  });
});
