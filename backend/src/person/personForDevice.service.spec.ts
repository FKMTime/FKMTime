import { DbService } from 'src/db/db.service';
import { WcaService } from 'src/wca/wca.service';

import {
  Attempt,
  AttemptStatus,
  AttemptType,
  HardwareVersion,
} from '../generated/prisma/client';
import { unusedDependency } from '../test-utils/unused-dependency';
import { PersonForDeviceService } from './personForDevice.service';

describe('PersonForDeviceService finished rounds', () => {
  const roundId = '333-r1';
  const wcif = {
    events: [
      {
        id: '333',
        rounds: [
          {
            id: roundId,
            format: 'a',
            cutoff: {
              numberOfAttempts: 2,
              resultValue: 1200,
            },
          },
        ],
      },
    ],
  };
  const attempt = (overrides: Partial<Attempt>) =>
    ({
      replacedBy: null,
      type: AttemptType.STANDARD_ATTEMPT,
      status: AttemptStatus.STANDARD,
      penalty: 0,
      value: 1500,
      ...overrides,
    }) as Attempt;

  const finishedRounds = (attempts: Attempt[]) => {
    const prisma = {
      result: {
        findMany: jest.fn().mockResolvedValue([
          {
            roundId,
            attempts,
            eventId: '333',
            person: { registrantId: 1, wcaId: null },
          },
        ]),
      },
    };
    const service = new PersonForDeviceService(
      prisma as unknown as DbService,
      unusedDependency(),
      new WcaService(unusedDependency()),
      unusedDependency(),
      unusedDependency(),
    );
    return service['getFinishedRoundIds'](
      'person-1',
      {} as never,
      wcif as never,
    );
  };

  it('ignores a replaced time that met the cutoff', async () => {
    const finished = await finishedRounds([
      attempt({
        id: 's1',
        attemptNumber: 1,
        value: 1000,
        replacedBy: 1,
        status: AttemptStatus.EXTRA_GIVEN,
      }),
      attempt({
        id: 's2',
        attemptNumber: 2,
        value: 1000,
        replacedBy: 2,
        status: AttemptStatus.EXTRA_GIVEN,
      }),
      attempt({ id: 'e1', attemptNumber: 1, type: AttemptType.EXTRA_ATTEMPT }),
      attempt({ id: 'e2', attemptNumber: 2, type: AttemptType.EXTRA_ATTEMPT }),
    ]);

    expect(finished).toEqual([roundId]);
  });

  it('keeps the round open when a counting attempt met the cutoff', async () => {
    const finished = await finishedRounds([
      attempt({ id: 's1', attemptNumber: 1, value: 1000 }),
      attempt({ id: 's2', attemptNumber: 2 }),
    ]);

    expect(finished).toEqual([]);
  });
});

describe('PersonForDeviceService on a station in tutorial mode (SPEC-012)', () => {
  const person = {
    id: 'p-1',
    name: 'Ada Example',
    countryIso2: 'PL',
    registrantId: 1,
    cardId: '100',
  };
  const setup = (tutorialEndsAt: Date | null) => {
    const prisma = {
      competition: {
        // A room with nothing running, and nobody registered for anything
        findFirst: jest.fn().mockResolvedValue({
          defaultLocale: 'en',
          wcif: {
            events: [],
            persons: [
              {
                registrantId: 1,
                assignments: [],
                registration: { eventIds: [] },
              },
            ],
            schedule: { venues: [] },
          },
        }),
      },
      result: { findMany: jest.fn().mockResolvedValue([]) },
      device: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'device-1',
          tutorialEndsAt,
          customRoundId: null,
          room: { currentGroupIds: [] },
        }),
      },
    };
    const personService = {
      getPersonByCardId: jest.fn(async (cardId: string) =>
        cardId === '100' ? person : null,
      ),
    };
    const deviceService = { extendTutorial: jest.fn() };
    const service = new PersonForDeviceService(
      prisma as unknown as DbService,
      personService as never,
      unusedDependency(),
      unusedDependency(),
      deviceService as never,
    );
    return { service, deviceService };
  };

  it("offers only the tutorial, named in the competitor's language", async () => {
    const { service, deviceService } = setup(new Date(Date.now() + 60_000));

    const reply = await service.getPersonInfo('100', 7, true);

    expect(reply).toMatchObject({
      name: 'Ada Example',
      possibleGroups: [
        {
          groupId: 'tutorial',
          name: 'Szkolenie',
          secondaryText: 'Szkolenie',
          useInspection: true,
          limit: null,
        },
      ],
    });
    expect(deviceService.extendTutorial).toHaveBeenCalledWith('device-1');
  });

  it("still says when the card isn't assigned", async () => {
    const { service, deviceService } = setup(new Date(Date.now() + 60_000));

    const reply = await service.getPersonInfo('999', 7, true);

    expect(reply).toMatchObject({
      error: true,
      errorDetails: { key: 'competitorNotFound' },
    });
    expect(deviceService.extendTutorial).not.toHaveBeenCalled();
  });

  it('goes back to rounds once the mode has ended', async () => {
    const { service, deviceService } = setup(new Date(Date.now() - 1));

    const reply = await service.getPersonInfo('100', 7, false);

    expect(reply).toMatchObject({ possibleGroups: [] });
    expect(deviceService.extendTutorial).not.toHaveBeenCalled();
  });
});

describe('PersonForDeviceService with data the WCIF does not have', () => {
  const wcif = {
    events: [
      {
        id: '333mbf',
        // Multi-blind has no time limit in the WCIF
        rounds: [{ id: '333mbf-r1', format: '1', timeLimit: null }],
      },
    ],
    persons: [],
    schedule: { venues: [] },
  };
  const service = (
    prisma: object,
    personService: object = {},
    resultService: object = {},
  ) =>
    new PersonForDeviceService(
      prisma as unknown as DbService,
      personService as never,
      new WcaService(unusedDependency()),
      resultService as never,
      { extendTutorial: jest.fn() } as never,
    );

  it('answers a card of someone added on site, who has no WCIF entry', async () => {
    const person = {
      id: 'p-onsite',
      name: 'Added On Site',
      countryIso2: 'PL',
      registrantId: null,
      cardId: '200',
    };
    const reply = await service(
      {
        competition: {
          findFirst: jest.fn().mockResolvedValue({ defaultLocale: 'en', wcif }),
        },
        result: { findMany: jest.fn().mockResolvedValue([]) },
        device: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'device-1',
            tutorialEndsAt: null,
            customRoundId: null,
            room: { currentGroupIds: ['333mbf-r1-g1'] },
          }),
        },
      },
      { getPersonByCardId: jest.fn().mockResolvedValue(person) },
    ).getPersonInfo('200', 7, true);

    expect(reply).toMatchObject({ id: 'p-onsite', possibleGroups: [] });
  });

  it('counts no round as finished that the WCIF no longer has', async () => {
    const finished = await service({
      result: {
        findMany: jest.fn().mockResolvedValue([
          {
            roundId: '333-r1',
            attempts: [{ id: 'a1' }],
            eventId: '333',
            person: { registrantId: 1, wcaId: null },
          },
        ]),
      },
    })['getFinishedRoundIds']('person-1', {} as never, wcif as never);

    expect(finished).toEqual([]);
  });

  it('gives a group of a round without a time limit no limit', async () => {
    const text = await service(
      {},
      {},
      {
        getNextAttemptData: jest
          .fn()
          .mockResolvedValue({ scrambleData: { num: 1, isExtra: false } }),
      },
    ).computeSecondaryText(
      '333mbf-r1-g1',
      wcif as never,
      'person-1',
      'en',
      HardwareVersion.V4,
      '200',
    );

    expect(text).toMatchObject({ limit: null });
  });
});
