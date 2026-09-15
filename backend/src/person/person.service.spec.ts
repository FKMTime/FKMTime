import { HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

import { DbService } from '../db/db.service';
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
              count: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            staffActivity: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
              deleteMany: jest.fn(),
              update: jest.fn(),
            },
            user: {
              findUnique: jest.fn(),
            },
            competition: {
              findFirst: jest.fn(),
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

      const prismaError = new PrismaClientKnownRequestError(
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

    beforeEach(() => {
      jest.spyOn(dbService.staffActivity, 'findFirst').mockResolvedValue({
        id: 'staff-activity-1',
        personId: 'person-1',
        groupId: '333-r1-g1',
        person: { id: 'person-1', registrantId: 1 },
      } as never);
      jest.spyOn(dbService.staffActivity, 'findMany').mockResolvedValue([]);
      jest.spyOn(dbService.user, 'findUnique').mockResolvedValue({
        wcaUserId: '1',
        wcaAccessToken: 'token',
      } as never);
      jest.spyOn(dbService.competition, 'findFirst').mockResolvedValue({
        wcaId: 'ExampleOpen2026',
      } as never);
      jest.spyOn(wcaService, 'getWcif').mockResolvedValue(wcif as never);
      jest
        .spyOn(dbService.staffActivity, 'deleteMany')
        .mockResolvedValue({ count: 0 });
      jest
        .spyOn(dbService.staffActivity, 'update')
        .mockResolvedValue({} as never);
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
