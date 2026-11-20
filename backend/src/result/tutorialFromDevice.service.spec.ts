import { EnterAttemptDto } from './dto/enterAttempt.dto';
import { TutorialFromDeviceService } from './tutorialFromDevice.service';

describe('TutorialFromDeviceService (SPEC-012)', () => {
  const competitor = {
    id: 'p-1',
    name: 'Ada Example',
    countryIso2: 'PL',
    cardId: '100',
  };
  const judge = { id: 'p-2', name: 'Ben Example', countryIso2: 'PL' };
  const station = {
    id: 'device-1',
    name: 'Station 7',
    roomId: 'room-1',
    tutorialEndsAt: new Date(Date.now() + 60_000),
  };

  let prisma: { competition: { findFirst: jest.Mock } };
  let personService: { getPersonByCardId: jest.Mock };
  let deviceService: {
    getDeviceByEspId: jest.Mock;
    extendTutorial: jest.Mock;
  };
  let tutorialIncidents: { record: jest.Mock };
  let service: TutorialFromDeviceService;

  const attempt = (overrides: Partial<EnterAttemptDto> = {}) =>
    ({
      value: 1234,
      valueMs: 12340,
      penalty: 0,
      inspectionTime: 8000,
      solvedAt: new Date(),
      espId: 7,
      competitorId: 100,
      judgeId: 200,
      isDelegate: false,
      sessionId: 'session-1',
      groupId: 'tutorial',
      ...overrides,
    }) as EnterAttemptDto;

  beforeEach(() => {
    // Only reads: a tutorial solve has nothing to write
    prisma = {
      competition: {
        findFirst: jest.fn().mockResolvedValue({ defaultLocale: 'en' }),
      },
    };
    personService = {
      getPersonByCardId: jest.fn(async (cardId: string) =>
        cardId === '100' ? competitor : cardId === '200' ? judge : null,
      ),
    };
    deviceService = {
      getDeviceByEspId: jest.fn().mockResolvedValue(station),
      extendTutorial: jest.fn().mockResolvedValue(undefined),
    };
    tutorialIncidents = { record: jest.fn() };
    service = new TutorialFromDeviceService(
      prisma as never,
      personService as never,
      deviceService as never,
      tutorialIncidents as never,
    );
  });

  describe('which solves are tutorial ones', () => {
    it('is decided by the group given at the card scan', async () => {
      deviceService.getDeviceByEspId.mockResolvedValue({
        ...station,
        tutorialEndsAt: null,
      });

      // The mode ended mid-solve: the screen said Tutorial, so it still is
      expect(await service.isTutorialAttempt(attempt())).toBe(true);
    });

    it('saves a solve with a real group, even on a station in tutorial', async () => {
      expect(
        await service.isTutorialAttempt(attempt({ groupId: '333-r1-g1' })),
      ).toBe(false);
    });

    it("follows the station's mode when the solve has no group", async () => {
      expect(
        await service.isTutorialAttempt(attempt({ groupId: undefined })),
      ).toBe(true);
      deviceService.getDeviceByEspId.mockResolvedValue({
        ...station,
        tutorialEndsAt: null,
      });
      expect(
        await service.isTutorialAttempt(attempt({ groupId: undefined })),
      ).toBe(false);
    });
  });

  it('answers a solve as done without saving it, and extends the mode', async () => {
    const reply = await service.enterAttempt(attempt());

    expect(reply).toEqual({
      message: 'Proba ze szkolenia, nie zapisano',
      shouldResetTime: true,
      status: 200,
      error: false,
    });
    expect(deviceService.extendTutorial).toHaveBeenCalledWith('device-1');
    expect(tutorialIncidents.record).not.toHaveBeenCalled();
  });

  it("still says when the competitor's card isn't assigned", async () => {
    const reply = await service.enterAttempt(attempt({ competitorId: 999 }));

    expect(reply).toMatchObject({
      error: true,
      errorDetails: { key: 'competitorNotFound', cardId: 999 },
    });
    expect(deviceService.extendTutorial).not.toHaveBeenCalled();
  });

  it("still says when the judge's card isn't assigned", async () => {
    const reply = await service.enterAttempt(attempt({ judgeId: 999 }));

    expect(reply).toMatchObject({
      error: true,
      errorDetails: { key: 'judgeNotFound' },
    });
  });

  it("still says when the competitor's card was scanned as the judge's", async () => {
    const reply = await service.enterAttempt(attempt({ judgeId: 100 }));

    expect(reply).toMatchObject({
      error: true,
      errorDetails: { key: 'judgeIsCompetitor' },
    });
  });

  it('keeps a delegate call as a tutorial incident', async () => {
    const reply = await service.enterAttempt(
      attempt({ isDelegate: true, judgeId: undefined, penalty: 2 }),
    );

    expect(reply).toMatchObject({ error: false, status: 200 });
    expect(tutorialIncidents.record).toHaveBeenCalledWith({
      espId: 7,
      deviceName: 'Station 7',
      roomId: 'room-1',
      competitorName: 'Ada Example',
      judgeName: null,
      value: 1234,
      penalty: 2,
      inspectionTime: 8000,
      sessionId: 'session-1',
    });
  });
});
