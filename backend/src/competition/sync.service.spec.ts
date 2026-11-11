import { SyncService } from './sync.service';

describe('SyncService', () => {
  describe('updateWcif', () => {
    const wcif = {
      statusCode: 200,
      name: 'Test Open',
      countryIso2: 'PL',
      schedule: {
        venues: [
          {
            rooms: [
              {
                name: 'Main',
                color: '#000000',
                activities: [
                  {
                    id: 1,
                    activityCode: '333-r1',
                    childActivities: [
                      { id: 2, activityCode: '333-r1-g1', childActivities: [] },
                      { id: 3, activityCode: '333-r1-g2', childActivities: [] },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      persons: [
        {
          registrantId: 1,
          name: 'Alex Doe',
          wcaId: null,
          gender: 'o',
          countryIso2: 'PL',
          assignments: [{ activityId: 2, assignmentCode: 'competitor' }],
        },
        {
          registrantId: 2,
          name: 'Sam Roe',
          wcaId: null,
          gender: 'o',
          countryIso2: 'PL',
          assignments: [],
        },
      ],
    };
    const activity = (
      id: string,
      personId: string,
      groupId: string,
      role: string,
      isAssigned: boolean,
      status = 'ABSENT',
    ) => ({ id, personId, groupId, role, isAssigned, status });

    const setup = (existingActivities: ReturnType<typeof activity>[]) => {
      const persons = wcif.persons.map((person) => ({
        id: `person-${person.registrantId}`,
        registrantId: person.registrantId,
        name: person.name,
        wcaId: person.wcaId,
        gender: person.gender,
        countryIso2: person.countryIso2,
      }));
      const prisma = {
        user: { findFirst: jest.fn().mockResolvedValue({ id: 'user-1' }) },
        room: {
          findMany: jest.fn().mockResolvedValue([{ name: 'Main' }]),
          createMany: jest.fn(),
        },
        person: {
          findMany: jest.fn().mockResolvedValue(persons),
          createMany: jest.fn(),
          update: jest.fn(),
          deleteMany: jest.fn(),
        },
        staffActivity: {
          findMany: jest.fn().mockResolvedValue(existingActivities),
          createMany: jest.fn(),
          updateMany: jest.fn(),
          deleteMany: jest.fn(),
        },
        competition: { updateMany: jest.fn() },
        $transaction: jest.fn(async (arg) =>
          typeof arg === 'function' ? arg(prisma) : Promise.all(arg),
        ),
      };
      const service = new SyncService(
        prisma as never,
        { getWcif: jest.fn().mockResolvedValue(wcif) } as never,
        {} as never,
        { invalidateCardCache: jest.fn() } as never,
      );
      jest.spyOn(service, 'addUnofficialEventsToWcif').mockResolvedValue();
      return { prisma, service };
    };

    it('removes assignments that are no longer in the WCIF', async () => {
      const { prisma, service } = setup([
        activity('kept', 'person-1', '333-r1-g1', 'COMPETITOR', true),
        activity('moved', 'person-1', '333-r1-g2', 'JUDGE', true),
        activity('last-one', 'person-2', '333-r1-g2', 'COMPETITOR', true),
        activity(
          'walk-in',
          'person-2',
          '333-r1-g1',
          'RUNNER',
          false,
          'PRESENT',
        ),
      ]);

      await service.updateWcif('TestOpen2026', 'user-1');

      expect(prisma.staffActivity.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['moved', 'last-one'] } },
      });
      expect(prisma.staffActivity.createMany).toHaveBeenCalledWith({
        data: [],
        skipDuplicates: true,
      });
    });

    it('keeps attendance for a removed assignment as an unassigned row', async () => {
      const { prisma, service } = setup([
        activity('kept', 'person-1', '333-r1-g1', 'COMPETITOR', true),
        activity('judged', 'person-1', '333-r1-g2', 'JUDGE', true, 'PRESENT'),
      ]);

      await service.updateWcif('TestOpen2026', 'user-1');

      expect(prisma.staffActivity.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: [] } },
      });
      expect(prisma.staffActivity.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['judged'] } },
        data: { isAssigned: false },
      });
    });
  });

  describe('addUnofficialEventsToWcif', () => {
    it('does not overwrite official FTO with a legacy unofficial event', async () => {
      const prisma = {
        unofficialEvent: {
          findMany: jest.fn().mockResolvedValue([
            { eventId: 'fto', wcif: { id: 'fto', source: 'legacy' } },
            { eventId: 'mirror', wcif: { id: 'mirror', source: 'local' } },
          ]),
        },
        competition: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'competition-1',
            wcif: {
              events: [
                { id: 'fto', source: 'WCA' },
                { id: 'mirror', source: 'stale' },
              ],
            },
          }),
          update: jest.fn().mockResolvedValue({}),
        },
      };
      const competitionService = { invalidateWcifCache: jest.fn() };
      const service = new SyncService(
        prisma as never,
        {} as never,
        competitionService as never,
        {} as never,
      );

      await service.addUnofficialEventsToWcif();

      expect(prisma.competition.update).toHaveBeenCalledWith({
        where: { id: 'competition-1' },
        data: {
          wcif: {
            events: [
              { id: 'fto', source: 'WCA' },
              { id: 'mirror', source: 'local' },
            ],
          },
        },
      });
      expect(competitionService.invalidateWcifCache).toHaveBeenCalled();
    });
  });
});
