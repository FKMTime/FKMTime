import { H2hExportService, WCA_RETRY_AFTER_MS } from './h2hExport.service';

describe('H2hExportService.fillWcaRoundId', () => {
  const setUp = (fetched: number | null) => {
    const prisma = {
      h2hBracket: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'bracket', wcaRoundId: null }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      competition: {
        findFirst: jest.fn().mockResolvedValue({ wcaId: 'ExampleOpen2026' }),
      },
    };
    const gateway = { handleH2hUpdated: jest.fn() };
    const wca = { getWcaRoundId: jest.fn().mockResolvedValue(fetched) };
    const service = new H2hExportService(
      prisma as never,
      gateway as never,
      {} as never,
      wca as never,
    );
    return { service, prisma, gateway, wca };
  };

  afterEach(() => jest.restoreAllMocks());

  it('stores the id the WCA gives and tells the panels', async () => {
    const { service, prisma, gateway, wca } = setUp(98765);

    await expect(service.fillWcaRoundId('333oh-r2')).resolves.toBe(98765);

    expect(wca.getWcaRoundId).toHaveBeenCalledWith(
      'ExampleOpen2026',
      '333oh-r2',
    );
    expect(prisma.h2hBracket.updateMany).toHaveBeenCalledWith({
      where: { id: 'bracket', wcaRoundId: null },
      data: { wcaRoundId: 98765 },
    });
    expect(gateway.handleH2hUpdated).toHaveBeenCalledWith('333oh-r2');
  });

  it("doesn't ask the WCA again for a minute after it failed", async () => {
    const { service, wca } = setUp(null);
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);

    await expect(service.fillWcaRoundId('333oh-r2')).resolves.toBeNull();
    now.mockReturnValue(1_000_000 + WCA_RETRY_AFTER_MS - 1);
    await expect(service.fillWcaRoundId('333oh-r2')).resolves.toBeNull();
    expect(wca.getWcaRoundId).toHaveBeenCalledTimes(1);

    now.mockReturnValue(1_000_000 + WCA_RETRY_AFTER_MS);
    wca.getWcaRoundId.mockResolvedValue(98765);
    await expect(service.fillWcaRoundId('333oh-r2')).resolves.toBe(98765);
    expect(wca.getWcaRoundId).toHaveBeenCalledTimes(2);
  });
});
