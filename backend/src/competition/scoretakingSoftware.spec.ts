import { CompetitionService } from './competition.service';

describe('CompetitionService following the WCA scoretaking software', () => {
  const setup = (
    stored: {
      wcaScoretakingSoftware: string | null;
      sendingResultsFrequency?: string;
    },
    fromWca: string | null,
  ) => {
    const competition = {
      id: 'competition-1',
      wcaId: 'ExampleOpen2026',
      scoretakingToken: 'token',
      wcaScoretakingCheckedAt: null,
      sendingResultsFrequency: 'AFTER_SOLVE',
      ...stored,
    };
    const prisma = {
      competition: {
        findFirst: jest.fn().mockResolvedValue(competition),
        update: jest.fn(async ({ data }) => ({ ...competition, ...data })),
      },
      result: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { roundId: '333-r1' },
            { roundId: 'mirror-r1' },
            { roundId: '222-r1' },
          ]),
      },
    };
    const appGateway = { handleScoretakingSoftwareChanged: jest.fn() };
    const resultService = { sendRound: jest.fn().mockResolvedValue({}) };
    const wcaService = {
      getScoretakingSoftware: jest.fn().mockResolvedValue(fromWca),
    };
    const service = new CompetitionService(
      prisma as never,
      appGateway as never,
      resultService as never,
      wcaService as never,
      {} as never,
    );
    return { service, prisma, appGateway, resultService };
  };

  it('stores the value on the first read without announcing a switch', async () => {
    const { service, prisma, appGateway, resultService } = setup(
      { wcaScoretakingSoftware: null },
      'internal',
    );

    const status = await service.refreshWcaScoretakingSoftware();

    expect(prisma.competition.update).toHaveBeenCalledWith({
      where: { id: 'competition-1' },
      data: {
        wcaScoretakingSoftware: 'internal',
        wcaScoretakingCheckedAt: expect.any(Date),
      },
    });
    expect(status.officialResultsDestination).toBe('WCA_INTEGRATED_LIVE');
    expect(appGateway.handleScoretakingSoftwareChanged).not.toHaveBeenCalled();
    expect(resultService.sendRound).not.toHaveBeenCalled();
  });

  it('announces a switch and sends every official round to the new destination', async () => {
    const { service, appGateway, resultService } = setup(
      { wcaScoretakingSoftware: 'external' },
      'wca_live',
    );

    await service.refreshWcaScoretakingSoftware();

    expect(appGateway.handleScoretakingSoftwareChanged).toHaveBeenCalledWith(
      'WCA_LIVE',
    );
    // mirror is unofficial: it still goes to Cubing Contests, so nothing changes
    expect(resultService.sendRound.mock.calls).toEqual([
      ['333-r1'],
      ['222-r1'],
    ]);
  });

  it('switches without sending when sending is paused', async () => {
    const { service, appGateway, resultService } = setup(
      { wcaScoretakingSoftware: 'external', sendingResultsFrequency: 'NEVER' },
      'wca_live',
    );

    await service.refreshWcaScoretakingSoftware();

    expect(appGateway.handleScoretakingSoftwareChanged).toHaveBeenCalled();
    expect(resultService.sendRound).not.toHaveBeenCalled();
  });

  it('does nothing more when the value is unchanged', async () => {
    const { service, appGateway, resultService } = setup(
      { wcaScoretakingSoftware: 'wca_live' },
      'wca_live',
    );

    await service.refreshWcaScoretakingSoftware();

    expect(appGateway.handleScoretakingSoftwareChanged).not.toHaveBeenCalled();
    expect(resultService.sendRound).not.toHaveBeenCalled();
  });

  it('keeps the last value when the WCA cannot be reached', async () => {
    const { service, prisma } = setup(
      { wcaScoretakingSoftware: 'wca_live' },
      null,
    );

    const status = await service.refreshWcaScoretakingSoftware();

    expect(prisma.competition.update).not.toHaveBeenCalled();
    expect(status.wcaScoretakingSoftware).toBe('wca_live');
    expect(status.officialResultsDestination).toBe('WCA_LIVE');
  });
});
