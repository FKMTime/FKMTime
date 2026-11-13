import { decryptSecret, encryptSecret } from 'src/secret-box';

import { IntegratedLiveConnectionService } from './integratedLiveConnection.service';

describe('IntegratedLiveConnectionService', () => {
  const secret = process.env.SECRET;
  let competition: Record<string, unknown>;
  let wcaService: Record<string, jest.Mock>;
  let appGateway: { handleIntegratedLiveConnectionChanged: jest.Mock };
  let service: IntegratedLiveConnectionService;
  let fetchMock: jest.Mock;

  const tokens = (n: number, expiresIn = 7200) => ({
    accessToken: `access-${n}`,
    refreshToken: `refresh-${n}`,
    expiresIn,
  });

  const connectedWith = (n: number, expiresInMs: number) => {
    Object.assign(competition, {
      wcaLiveAccessToken: encryptSecret(`access-${n}`),
      wcaLiveRefreshToken: encryptSecret(`refresh-${n}`),
      wcaLiveTokenExpiresAt: new Date(Date.now() + expiresInMs),
    });
  };

  beforeEach(() => {
    process.env.SECRET = 'a-test-secret-that-is-long-enough-for-fkmtime';
    competition = {
      id: 'competition-1',
      wcaId: 'ExampleOpen2026',
      wcaScoretakingSoftware: 'internal',
      wcaLiveAccessToken: null,
      wcaLiveRefreshToken: null,
      wcaLiveTokenExpiresAt: null,
      wcaLiveConnectionBrokenAt: null,
      wcaLiveConnectedName: null,
      wcaLiveCanEnterScores: null,
    };
    const prisma = {
      competition: {
        findFirst: jest.fn(async () => ({ ...competition })),
        update: jest.fn(async ({ data }) => Object.assign(competition, data)),
      },
    };
    wcaService = {
      exchangeCodeForTokens: jest.fn().mockResolvedValue(tokens(1)),
      refreshTokens: jest.fn(),
      getUserInfo: jest
        .fn()
        .mockResolvedValue({ me: { id: 42, name: 'Ada Example' } }),
      managesCompetition: jest.fn().mockResolvedValue(true),
      isScoretaker: jest.fn().mockResolvedValue(false),
    };
    appGateway = { handleIntegratedLiveConnectionChanged: jest.fn() };
    service = new IntegratedLiveConnectionService(
      prisma as never,
      wcaService as never,
      appGateway as never,
    );
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    process.env.SECRET = secret;
  });

  describe('connect', () => {
    it('stores the tokens encrypted and says who results are entered as', async () => {
      const status = await service.connect(
        'user-1',
        'code-1',
        'https://panel.example/competition/wca-live-connect',
      );

      expect(competition.wcaLiveAccessToken).not.toContain('access-1');
      expect(decryptSecret(competition.wcaLiveAccessToken as string)).toBe(
        'access-1',
      );
      expect(decryptSecret(competition.wcaLiveRefreshToken as string)).toBe(
        'refresh-1',
      );
      expect(status).toMatchObject({
        state: 'CONNECTED',
        connectedAs: 'Ada Example',
        canEnterScores: true,
        usesIntegratedLive: true,
      });
      expect(
        appGateway.handleIntegratedLiveConnectionChanged,
      ).toHaveBeenCalled();
    });

    it('accepts a scoretaker who does not manage the competition', async () => {
      wcaService.managesCompetition.mockResolvedValue(false);
      wcaService.isScoretaker.mockResolvedValue(true);

      const status = await service.connect('user-1', 'code-1', 'uri');

      expect(status.canEnterScores).toBe(true);
      expect(wcaService.isScoretaker).toHaveBeenCalledWith(
        'access-1',
        'ExampleOpen2026',
        42,
      );
    });

    it('says when the person may not enter scores', async () => {
      wcaService.managesCompetition.mockResolvedValue(false);

      const status = await service.connect('user-1', 'code-1', 'uri');

      expect(status.canEnterScores).toBe(false);
    });

    it('leaves it unknown when the WCA could not tell', async () => {
      wcaService.managesCompetition.mockResolvedValue(null);

      const status = await service.connect('user-1', 'code-1', 'uri');

      expect(status.canEnterScores).toBeNull();
    });

    it('refuses a sign-in the WCA does not accept', async () => {
      wcaService.exchangeCodeForTokens.mockResolvedValue(null);

      await expect(
        service.connect('user-1', 'bad-code', 'uri'),
      ).rejects.toMatchObject({ status: 400 });
      expect(competition.wcaLiveAccessToken).toBeNull();
    });

    it('clears an earlier broken state', async () => {
      connectedWith(0, 60_000);
      competition.wcaLiveConnectionBrokenAt = new Date();

      const status = await service.connect('user-1', 'code-1', 'uri');

      expect(status.state).toBe('CONNECTED');
    });
  });

  describe('getAccessToken', () => {
    it('returns null without a connection', async () => {
      await expect(service.getAccessToken()).resolves.toBeNull();
    });

    it('uses the stored token while it has time left', async () => {
      connectedWith(1, 60 * 60 * 1000);

      await expect(service.getAccessToken()).resolves.toBe('access-1');
      expect(wcaService.refreshTokens).not.toHaveBeenCalled();
    });

    it('refreshes a token that expires within five minutes, and stores the new pair', async () => {
      connectedWith(1, 60 * 1000);
      wcaService.refreshTokens.mockResolvedValue(tokens(2));

      await expect(service.getAccessToken()).resolves.toBe('access-2');
      expect(wcaService.refreshTokens).toHaveBeenCalledWith('refresh-1');
      expect(decryptSecret(competition.wcaLiveRefreshToken as string)).toBe(
        'refresh-2',
      );
    });

    it('shares one refresh between sends that ask at the same time', async () => {
      connectedWith(1, 60 * 1000);
      wcaService.refreshTokens.mockResolvedValue(tokens(2));

      const both = await Promise.all([
        service.getAccessToken(),
        service.getAccessToken(),
      ]);

      expect(both).toEqual(['access-2', 'access-2']);
      expect(wcaService.refreshTokens).toHaveBeenCalledTimes(1);
    });

    it('marks the connection broken when the refresh fails', async () => {
      connectedWith(1, 60 * 1000);
      wcaService.refreshTokens.mockResolvedValue(null);

      await expect(service.getAccessToken()).resolves.toBeNull();
      expect(competition.wcaLiveConnectionBrokenAt).toBeInstanceOf(Date);
      expect(
        appGateway.handleIntegratedLiveConnectionChanged,
      ).toHaveBeenCalled();
      expect((await service.getStatus()).state).toBe('BROKEN');
    });

    it('stops using a broken connection until someone reconnects', async () => {
      connectedWith(1, 60 * 60 * 1000);
      competition.wcaLiveConnectionBrokenAt = new Date();

      await expect(service.getAccessToken()).resolves.toBeNull();
    });
  });

  describe('authorizedFetch', () => {
    it('sends the token as a bearer token', async () => {
      connectedWith(1, 60 * 60 * 1000);
      fetchMock.mockResolvedValue({ status: 202 });

      await service.authorizedFetch('https://wca.example/api/v1/x', {
        method: 'POST',
      });

      const [, init] = fetchMock.mock.calls[0];
      expect(init.method).toBe('POST');
      expect(init.headers.get('Authorization')).toBe('Bearer access-1');
    });

    it('refreshes and retries once after a 401', async () => {
      connectedWith(1, 60 * 60 * 1000);
      wcaService.refreshTokens.mockResolvedValue(tokens(2));
      fetchMock
        .mockResolvedValueOnce({ status: 401 })
        .mockResolvedValueOnce({ status: 202 });

      const response = await service.authorizedFetch('https://wca.example/x');

      expect(response.status).toBe(202);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[1][1].headers.get('Authorization')).toBe(
        'Bearer access-2',
      );
    });

    it('returns null without a connection, without calling the WCA', async () => {
      await expect(
        service.authorizedFetch('https://wca.example/x'),
      ).resolves.toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it('disconnect forgets the tokens and the person', async () => {
    connectedWith(1, 60 * 60 * 1000);
    competition.wcaLiveConnectedName = 'Ada Example';

    const status = await service.disconnect();

    expect(competition.wcaLiveAccessToken).toBeNull();
    expect(competition.wcaLiveRefreshToken).toBeNull();
    expect(status).toMatchObject({ state: 'NOT_CONNECTED', connectedAs: null });
  });
});
