import { HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { DbService } from '../db/db.service';
import { Prisma } from '../generated/prisma/client';
import { WcaService } from '../wca/wca.service';
import { PersonService } from './person.service';

describe('PersonService', () => {
  let service: PersonService;
  let dbService: DbService;
  let wcaService: WcaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PersonService,
        {
          provide: DbService,
          useValue: {
            person: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              count: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            staffActivity: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
              deleteMany: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              create: jest.fn(),
            },
            user: {
              findUnique: jest.fn(),
            },
            competition: {
              findFirstOrThrow: jest.fn(),
            },
          },
        },
        {
          provide: WcaService,
          useValue: {
            getWcif: jest.fn(),
            patchWcif: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PersonService>(PersonService);
    dbService = module.get<DbService>(DbService);
    wcaService = module.get<WcaService>(WcaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkIn', () => {
    it('should check in a person successfully', async () => {
      const personId = 'person1';
      const updateData = { cardId: 'CARD123' };

      jest.spyOn(dbService.person, 'update').mockResolvedValue({} as any);
      jest.spyOn(dbService.person, 'count').mockResolvedValueOnce(10);
      jest.spyOn(dbService.person, 'count').mockResolvedValueOnce(50);

      const result = await service.checkIn(personId, updateData);

      expect(result).toEqual({
        message: 'Checked in successfully',
        checkedInPersonsCount: 10,
        totalPersonsCount: 50,
      });
      expect(dbService.person.update).toHaveBeenCalledWith({
        where: { id: personId },
        data: {
          checkedInAt: expect.any(Date),
          cardId: 'CARD123',
        },
      });
    });

    it('should throw error if card already assigned', async () => {
      const personId = 'person1';
      const updateData = { cardId: 'CARD123' };

      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '5.0.0',
        },
      );

      jest.spyOn(dbService.person, 'update').mockRejectedValue(prismaError);

      await expect(service.checkIn(personId, updateData)).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('undoCheckIn', () => {
    it('clears the check-in and keeps the card by default', async () => {
      await service.undoCheckIn('person-1', false);
      expect(dbService.person.update).toHaveBeenCalledWith({
        where: { id: 'person-1' },
        data: { checkedInAt: null },
      });
    });

    it('also clears a card assigned during that check-in', async () => {
      await service.undoCheckIn('person-1', true);
      expect(dbService.person.update).toHaveBeenCalledWith({
        where: { id: 'person-1' },
        data: { checkedInAt: null, cardId: null },
      });
    });
  });

  describe('getPersons', () => {
    const whereOf = (method: 'findMany' | 'count') =>
      (dbService.person[method] as jest.Mock).mock.calls[0][0].where;
    const searchCondition = {
      OR: [
        { name: { contains: 'Example', mode: 'insensitive' } },
        { wcaId: { contains: 'Example', mode: 'insensitive' } },
      ],
    };

    it('keeps the not checked in filter when searching', async () => {
      await service.getPersons(
        1,
        10,
        'Example',
        undefined,
        false,
        undefined,
        false,
        true,
      );

      expect(whereOf('findMany')).toEqual({
        AND: [searchCondition, { checkedInAt: null }],
      });
      expect(whereOf('count')).toEqual(whereOf('findMany'));
    });

    it('requires newcomers to be able to compete when searching', async () => {
      await service.getPersons(
        1,
        10,
        'Example',
        undefined,
        false,
        undefined,
        true,
        false,
      );

      expect(whereOf('findMany')).toEqual({
        AND: [searchCondition, { wcaId: null, canCompete: true }],
      });
    });

    it('filters persons without a card when there is no search term', async () => {
      await service.getPersons(1, 10, undefined, undefined, true);

      expect(whereOf('findMany')).toEqual({
        AND: [{ OR: [{ cardId: null }, { cardId: '' }, { cardId: '0' }] }],
      });
    });

    it('combines every filter', async () => {
      await service.getPersons(1, 10, 'Example', 7, true, 'CARD', true, true);

      expect(whereOf('findMany')).toEqual({
        AND: [
          searchCondition,
          { registrantId: 7 },
          { cardId: 'CARD' },
          { OR: [{ cardId: null }, { cardId: '' }, { cardId: '0' }] },
          { wcaId: null, canCompete: true },
          { checkedInAt: null },
        ],
      });
    });

    it('lists everyone when no filter is set', async () => {
      await service.getPersons(1, 10);

      expect(whereOf('findMany')).toEqual({ AND: [] });
    });
  });

  describe('checkedInCount', () => {
    it('should return checked in count and persons who did not check in', async () => {
      const mockPersonsWhoDidNotCheckIn = [
        {
          id: 'person1',
          name: 'John Doe',
          registrantId: 1,
          wcaId: null,
          cardId: null,
          canCompete: true,
          countryIso2: 'US',
          birthdate: '2000-01-01',
        },
      ];

      jest.spyOn(dbService.person, 'count').mockResolvedValueOnce(45);
      jest.spyOn(dbService.person, 'count').mockResolvedValueOnce(50);
      jest
        .spyOn(dbService.person, 'findMany')
        .mockResolvedValue(mockPersonsWhoDidNotCheckIn as any);

      const result = await service.checkedInCount();

      expect(result).toEqual({
        checkedInPersonsCount: 45,
        totalPersonsCount: 50,
        personsWhoDidNotCheckIn: mockPersonsWhoDidNotCheckIn,
      });
    });
  });

  describe('addCompetingGroup', () => {
    const wcif = {
      id: 'ExampleOpen2026',
      formatVersion: '2.1.1',
      persons: [{ registrantId: 7, assignments: [] }],
      schedule: {
        venues: [
          {
            rooms: [
              {
                activities: [
                  { id: 203, activityCode: '333-r2-g3', childActivities: [] },
                ],
              },
            ],
          },
        ],
      },
    };

    beforeEach(() => {
      jest.spyOn(dbService.staffActivity, 'findFirst').mockResolvedValue(null);
      jest
        .spyOn(dbService.person, 'findUnique')
        .mockResolvedValue({ id: 'person-7', registrantId: 7 } as never);
      jest.spyOn(dbService.user, 'findUnique').mockResolvedValue({
        wcaUserId: '1',
        wcaAccessToken: 'token',
      } as never);
      jest.spyOn(dbService.competition, 'findFirstOrThrow').mockResolvedValue({
        wcaId: 'ExampleOpen2026',
      } as never);
      jest.spyOn(wcaService, 'getWcif').mockResolvedValue(wcif as never);
      jest
        .spyOn(dbService.staffActivity, 'create')
        .mockResolvedValue({} as never);
    });

    it('adds the assignment to the WCIF, then the group record', async () => {
      jest
        .spyOn(wcaService, 'patchWcif')
        .mockResolvedValue({ statusCode: 200 });

      await service.addCompetingGroup('user-1', 'person-7', '333-r2-g3');

      expect(wcaService.patchWcif).toHaveBeenCalledWith(
        'ExampleOpen2026',
        expect.objectContaining({
          persons: [
            expect.objectContaining({
              registrantId: 7,
              assignments: [
                {
                  activityId: 203,
                  stationNumber: null,
                  assignmentCode: 'competitor',
                },
              ],
            }),
          ],
        }),
        'token',
      );
      expect(dbService.staffActivity.create).toHaveBeenCalledWith({
        data: {
          personId: 'person-7',
          groupId: '333-r2-g3',
          role: 'COMPETITOR',
          isAssigned: true,
        },
      });
    });

    it('changes nothing in FKMTime when the WCA rejects the WCIF', async () => {
      jest
        .spyOn(wcaService, 'patchWcif')
        .mockResolvedValue({ statusCode: 422, error: 'Invalid WCIF' });

      await expect(
        service.addCompetingGroup('user-1', 'person-7', '333-r2-g3'),
      ).rejects.toMatchObject({ status: 422 });
      expect(dbService.staffActivity.create).not.toHaveBeenCalled();
    });

    it('refuses someone who already has a group in the round', async () => {
      jest
        .spyOn(dbService.staffActivity, 'findFirst')
        .mockResolvedValue({ id: 'existing' } as never);

      await expect(
        service.addCompetingGroup('user-1', 'person-7', '333-r2-g3'),
      ).rejects.toMatchObject({ status: 409 });
    });
  });

  describe('changeCompetingGroup', () => {
    const wcif = {
      id: 'ExampleOpen2026',
      formatVersion: '2.1.1',
      persons: [
        {
          registrantId: 1,
          assignments: [
            {
              activityId: 101,
              stationNumber: 1,
              assignmentCode: 'competitor',
            },
          ],
        },
      ],
      schedule: {
        venues: [
          {
            rooms: [
              {
                activities: [
                  {
                    id: 101,
                    activityCode: '333-r1-g1',
                    childActivities: [],
                  },
                  {
                    id: 102,
                    activityCode: '333-r1-g2',
                    childActivities: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    };

    type Row = {
      id: string;
      personId: string;
      groupId: string;
      role: string;
      isAssigned: boolean;
    };
    type GroupFilter = string | { contains?: string; startsWith?: string };
    let rows: Row[];

    const groupMatches = (groupId: string, filter?: GroupFilter) => {
      if (filter === undefined) return true;
      if (typeof filter === 'string') return groupId === filter;
      if (filter.contains !== undefined) {
        return groupId.includes(filter.contains);
      }
      return groupId.startsWith(filter.startsWith ?? '');
    };
    const competitorRow = (overrides: Partial<Row>): Row => ({
      id: 'row-assigned',
      personId: 'person-1',
      groupId: '333-r1-g1',
      role: 'COMPETITOR',
      isAssigned: true,
      ...overrides,
    });
    const moveTo = (newGroupId: string) =>
      service.changeCompetingGroup('user-1', {
        personId: 'person-1',
        newGroupId,
      });

    beforeEach(() => {
      rows = [competitorRow({})];
      // Answers both lookups the way the database would, so a loose groupId
      // filter picks up the rows it would really pick up
      const find = ({
        where,
      }: {
        where: { personId?: string; role?: string; groupId?: GroupFilter };
      }) =>
        rows
          .filter(
            (row) =>
              (!where.personId || row.personId === where.personId) &&
              (!where.role || row.role === where.role) &&
              groupMatches(row.groupId, where.groupId),
          )
          .map((row) => ({
            ...row,
            person: { id: 'person-1', registrantId: 1 },
          }));
      jest
        .spyOn(dbService.staffActivity, 'findFirst')
        .mockImplementation((async (args) => find(args)[0] ?? null) as never);
      jest
        .spyOn(dbService.staffActivity, 'findMany')
        .mockImplementation((async (args) => find(args)) as never);
      jest.spyOn(dbService.user, 'findUnique').mockResolvedValue({
        wcaUserId: '1',
        wcaAccessToken: 'token',
      } as never);
      jest.spyOn(dbService.competition, 'findFirstOrThrow').mockResolvedValue({
        wcaId: 'ExampleOpen2026',
      } as never);
      jest.spyOn(wcaService, 'getWcif').mockResolvedValue(wcif as never);
      jest
        .spyOn(dbService.staffActivity, 'deleteMany')
        .mockResolvedValue({ count: 0 });
      jest
        .spyOn(dbService.staffActivity, 'update')
        .mockResolvedValue({} as never);
      jest
        .spyOn(dbService.staffActivity, 'delete')
        .mockResolvedValue({} as never);
    });

    describe('picking the row to move', () => {
      beforeEach(() => {
        jest
          .spyOn(wcaService, 'patchWcif')
          .mockResolvedValue({ statusCode: 200 });
      });

      it('leaves the same group in round 10 alone when moving in round 1', async () => {
        rows = [
          competitorRow({ id: 'row-r10', groupId: '333-r10-g1' }),
          competitorRow({ id: 'row-r1', groupId: '333-r1-g1' }),
        ];

        await moveTo('333-r1-g2');

        expect(dbService.staffActivity.update).toHaveBeenCalledTimes(1);
        expect(dbService.staffActivity.update).toHaveBeenCalledWith({
          where: { id: 'row-r1' },
          data: { groupId: '333-r1-g2', isAssigned: true },
        });
      });

      it('moves the assigned group, not a walk-in in the same round', async () => {
        rows = [
          competitorRow({
            id: 'row-walk-in',
            groupId: '333-r1-g3',
            isAssigned: false,
          }),
          competitorRow({ id: 'row-assigned', groupId: '333-r1-g1' }),
        ];

        await moveTo('333-r1-g2');

        expect(dbService.staffActivity.update).toHaveBeenCalledTimes(1);
        expect(dbService.staffActivity.update).toHaveBeenCalledWith({
          where: { id: 'row-assigned' },
          data: { groupId: '333-r1-g2', isAssigned: true },
        });
      });

      it('keeps their walk-in row in the new group instead of a duplicate', async () => {
        rows = [
          competitorRow({ id: 'row-assigned', groupId: '333-r1-g1' }),
          competitorRow({
            id: 'row-walk-in',
            groupId: '333-r1-g2',
            isAssigned: false,
          }),
        ];

        await moveTo('333-r1-g2');

        expect(dbService.staffActivity.deleteMany).toHaveBeenCalledWith({
          where: {
            personId: 'person-1',
            groupId: '333-r1-g2',
            role: { not: 'COMPETITOR' },
          },
        });
        expect(dbService.staffActivity.update).toHaveBeenCalledTimes(1);
        expect(dbService.staffActivity.update).toHaveBeenCalledWith({
          where: { id: 'row-walk-in' },
          data: { isAssigned: true },
        });
        expect(dbService.staffActivity.delete).toHaveBeenCalledWith({
          where: { id: 'row-assigned' },
        });
      });
    });

    it('says they have no group to move when the round has no row for them', async () => {
      // Only a row in round 10, so nothing in round 1 to move
      rows = [competitorRow({ id: 'row-r10', groupId: '333-r10-g1' })];

      await expect(moveTo('333-r1-g2')).rejects.toMatchObject({
        status: 404,
        response:
          'They no longer have a group in this round. Refresh the page.',
      });
      expect(wcaService.getWcif).not.toHaveBeenCalled();
      expect(wcaService.patchWcif).not.toHaveBeenCalled();
      expect(dbService.staffActivity.create).not.toHaveBeenCalled();
      expect(dbService.staffActivity.update).not.toHaveBeenCalled();
      expect(dbService.staffActivity.delete).not.toHaveBeenCalled();
      expect(dbService.staffActivity.deleteMany).not.toHaveBeenCalled();
    });

    it('refuses a group the WCIF schedule does not have', async () => {
      rows = [competitorRow({ id: 'row-assigned', groupId: '333-r1-g1' })];

      await expect(moveTo('333-r1-g9')).rejects.toMatchObject({
        status: 404,
        response: 'Group or competitor not in the WCIF',
      });
      expect(wcaService.patchWcif).not.toHaveBeenCalled();
      expect(dbService.staffActivity.update).not.toHaveBeenCalled();
    });

    it('includes the required WCIF fields when changing assignments', async () => {
      jest.spyOn(wcaService, 'patchWcif').mockResolvedValue({
        statusCode: 200,
      });

      await service.changeCompetingGroup('user-1', {
        personId: 'person-1',
        newGroupId: '333-r1-g2',
      });

      expect(wcaService.patchWcif).toHaveBeenCalledWith(
        'ExampleOpen2026',
        expect.objectContaining({
          id: 'ExampleOpen2026',
          formatVersion: '2.1.1',
          persons: [
            expect.objectContaining({
              assignments: [
                {
                  activityId: 102,
                  stationNumber: null,
                  assignmentCode: 'competitor',
                },
              ],
            }),
          ],
        }),
        'token',
      );
    });

    it('exposes the WCA error field when the PATCH is rejected', async () => {
      jest.spyOn(wcaService, 'patchWcif').mockResolvedValue({
        statusCode: 400,
        error: 'The property formatVersion is required',
      });

      await expect(
        service.changeCompetingGroup('user-1', {
          personId: 'person-1',
          newGroupId: '333-r1-g2',
        }),
      ).rejects.toMatchObject({
        response: {
          message: 'The WCA rejected the WCIF update',
          error: 'The property formatVersion is required',
        },
        status: 400,
      });
    });
  });
});
