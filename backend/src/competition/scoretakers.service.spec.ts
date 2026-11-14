import { ScoretakersService } from './scoretakers.service';

const WCA = 'https://wca.example';
const BASE = `${WCA}/api/v1/competitions/ExampleOpen2026/scoretakers`;

describe('ScoretakersService', () => {
  const origin = process.env.WCA_ORIGIN;
  const realFetch = global.fetch;
  let fetchMock: jest.Mock;
  let connectionToken: string | null;
  let userToken: string | null;
  let connectedManages: boolean | null;
  let wcaService: {
    managesCompetition: jest.Mock;
    getUserInfoByWcaId: jest.Mock;
  };
  let service: ScoretakersService;

  const reply = (status: number, body: unknown = {}) => ({
    status,
    ok: status < 300,
    json: async () => body,
  });

  beforeEach(() => {
    process.env.WCA_ORIGIN = WCA;
    connectionToken = 'connection-token';
    userToken = 'user-token';
    connectedManages = true;
    fetchMock = jest.fn(async () =>
      reply(200, [{ user_id: 9000005, name: 'Scoretaker Example' }]),
    );
    global.fetch = fetchMock;
    wcaService = {
      managesCompetition: jest.fn(async () => connectedManages),
      getUserInfoByWcaId: jest.fn(async (wcaId: string) =>
        wcaId === '2020EXAM01'
          ? { user: { id: 9000007, name: 'New Example' } }
          : { error: 'not found' },
      ),
    };
    const prisma = {
      competition: {
        findFirst: jest.fn(async () => ({ wcaId: 'ExampleOpen2026' })),
      },
      user: {
        findUnique: jest.fn(async () => ({ wcaAccessToken: userToken })),
      },
    };
    const connection = {
      getAccessToken: jest.fn(async () => connectionToken),
    };
    service = new ScoretakersService(
      prisma as never,
      wcaService as never,
      connection as never,
    );
  });

  afterEach(() => {
    process.env.WCA_ORIGIN = origin;
    global.fetch = realFetch;
  });

  const lastCall = () => {
    const [url, init] = fetchMock.mock.calls.at(-1);
    return {
      url,
      method: init.method,
      token: init.headers.Authorization,
      body: init.body ? JSON.parse(init.body) : undefined,
    };
  };

  it('lists the scoretakers with the connection', async () => {
    await expect(service.list('u1')).resolves.toEqual({
      ok: true,
      scoretakers: [{ wcaUserId: 9000005, name: 'Scoretaker Example' }],
    });
    expect(lastCall()).toMatchObject({
      url: BASE,
      method: 'GET',
      token: 'Bearer connection-token',
    });
  });

  it("lists them with the user's WCA sign-in when there is no connection", async () => {
    connectionToken = null;

    await service.list('u1');

    expect(lastCall().token).toBe('Bearer user-token');
  });

  it('asks to sign in with WCA when there is neither', async () => {
    connectionToken = null;
    userToken = null;

    await expect(service.list('u1')).resolves.toMatchObject({
      ok: false,
      needsWcaSignIn: true,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('adds someone by WCA ID, as the connected person when they manage it', async () => {
    fetchMock.mockResolvedValue(reply(200, { user_id: 9000007 }));

    await expect(service.add('u1', ' 2020exam01 ')).resolves.toEqual({
      ok: true,
      message: 'New Example can now enter results',
    });
    expect(lastCall()).toEqual({
      url: BASE,
      method: 'POST',
      token: 'Bearer connection-token',
      body: { user_id: 9000007 },
    });
  });

  it("changes them with the user's own sign-in when the connected person doesn't manage it", async () => {
    connectedManages = false;

    await service.remove('u1', 9000005);

    expect(lastCall()).toMatchObject({
      url: `${BASE}/9000005`,
      method: 'DELETE',
      token: 'Bearer user-token',
    });
  });

  it('refuses an unknown WCA ID without calling the WCA', async () => {
    await expect(service.add('u1', '2099NONE01')).resolves.toEqual({
      ok: false,
      message: 'No WCA account with WCA ID 2099NONE01',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('asks a non-manager to sign in as someone who manages it', async () => {
    connectedManages = false;
    fetchMock.mockResolvedValue(
      reply(403, { error: 'Organizer privileges required' }),
    );

    await expect(service.remove('u1', 9000005)).resolves.toMatchObject({
      ok: false,
      needsWcaSignIn: true,
    });
  });

  it('asks to sign in again when the WCA sign-in expired', async () => {
    connectedManages = false;
    fetchMock.mockResolvedValue(reply(401, { error: 'Please log in' }));

    await expect(service.remove('u1', 9000005)).resolves.toEqual({
      ok: false,
      message: 'Sign in with WCA again to change scoretakers',
      needsWcaSignIn: true,
    });
  });

  it('needs a WCA sign-in to change anything without a managing connection', async () => {
    connectedManages = false;
    userToken = null;

    await expect(service.remove('u1', 9000005)).resolves.toMatchObject({
      ok: false,
      needsWcaSignIn: true,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
