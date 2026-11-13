import { CompetitionService } from './competition.service';

describe('CompetitionService settings', () => {
  it('never sends the WCA live results tokens to the panel', async () => {
    const stored = {
      id: 'competition-1',
      scoretakingToken: 'wca-live-token',
      wcaScoretakingSoftware: 'internal',
      wcaLiveAccessToken: 'encrypted-access',
      wcaLiveRefreshToken: 'encrypted-refresh',
      wcaLiveConnectionBrokenAt: null,
    };
    const prisma = {
      competition: {
        // Mirrors Prisma's omit
        findFirst: jest.fn(async ({ omit }) =>
          Object.fromEntries(
            Object.entries(stored).filter(([key]) => !omit?.[key]),
          ),
        ),
      },
    };
    const service = new CompetitionService(
      prisma as never,
      null,
      null,
      null,
      {
        hilRunning: () => false,
      } as never,
      null,
    );

    const settings = await service.getCompetitionSettings();

    expect(settings).not.toHaveProperty('wcaLiveAccessToken');
    expect(settings).not.toHaveProperty('wcaLiveRefreshToken');
    expect(settings).toMatchObject({
      officialResultsDestination: 'WCA_INTEGRATED_LIVE',
      integratedLiveConnection: 'CONNECTED',
    });
  });
});
