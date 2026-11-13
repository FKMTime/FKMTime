import { WcaService } from './wca.service';

describe('WcaService', () => {
  let service: WcaService;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    service = new WcaService({} as never);
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('patchWcif', () => {
    it('sends a schema-compliant partial WCIF to the canonical endpoint', async () => {
      const wcif = {
        id: 'ExampleOpen2026',
        formatVersion: '2.1.1',
        persons: [],
      };
      fetchMock.mockResolvedValue({
        json: jest
          .fn()
          .mockResolvedValue({ status: 'Successfully saved WCIF' }),
        status: 200,
        url: 'https://www.worldcubeassociation.org/api/v0/competitions/ExampleOpen2026/wcif',
      });

      await service.patchWcif('ExampleOpen2026', wcif, 'token');

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(
          /\/api\/v0\/competitions\/ExampleOpen2026\/wcif$/,
        ),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify(wcif),
        }),
      );
    });

    it('preserves the WCA error field for callers', async () => {
      fetchMock.mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          status: 'Error while saving WCIF',
          error: 'The property formatVersion is required',
        }),
        status: 400,
        url: 'https://www.worldcubeassociation.org/api/v0/competitions/ExampleOpen2026/wcif',
      });

      await expect(
        service.patchWcif(
          'ExampleOpen2026',
          { id: 'ExampleOpen2026', formatVersion: '2.1.1', persons: [] },
          'token',
        ),
      ).resolves.toMatchObject({
        statusCode: 400,
        error: 'The property formatVersion is required',
      });
    });
  });

  describe('getScoretakingSoftware', () => {
    it('returns how the WCA says results are entered', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ scoretaking_software: 'internal' }),
      });

      await expect(
        service.getScoretakingSoftware('ExampleOpen2026'),
      ).resolves.toBe('internal');
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/v0\/competitions\/ExampleOpen2026$/),
      );
    });

    it('returns null when the WCA answers with an error', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 502 });

      await expect(
        service.getScoretakingSoftware('ExampleOpen2026'),
      ).resolves.toBeNull();
    });

    it('returns null when the field is missing', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ id: 'ExampleOpen2026' }),
      });

      await expect(
        service.getScoretakingSoftware('ExampleOpen2026'),
      ).resolves.toBeNull();
    });

    it('returns null when the WCA cannot be reached', async () => {
      fetchMock.mockRejectedValue(new Error('offline'));

      await expect(
        service.getScoretakingSoftware('ExampleOpen2026'),
      ).resolves.toBeNull();
    });
  });

  describe('refreshTokens', () => {
    it('returns the new pair and its lifetime', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          access_token: 'access-2',
          refresh_token: 'refresh-2',
          expires_in: 7200,
        }),
      });

      await expect(service.refreshTokens('refresh-1')).resolves.toEqual({
        accessToken: 'access-2',
        refreshToken: 'refresh-2',
        expiresIn: 7200,
      });
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
        grant_type: 'refresh_token',
        refresh_token: 'refresh-1',
      });
    });

    it('returns null when the WCA refuses the refresh token', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 400 });

      await expect(service.refreshTokens('used-up')).resolves.toBeNull();
    });
  });

  describe('isScoretaker', () => {
    it('finds the user among the competition scoretakers', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue([{ user_id: 42, name: 'Ada' }]),
      });

      await expect(
        service.isScoretaker('token', 'ExampleOpen2026', 42),
      ).resolves.toBe(true);
      await expect(
        service.isScoretaker('token', 'ExampleOpen2026', 7),
      ).resolves.toBe(false);
    });

    it('returns null when the WCA cannot be asked', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 500 });

      await expect(
        service.isScoretaker('token', 'ExampleOpen2026', 42),
      ).resolves.toBeNull();
    });
  });
});
