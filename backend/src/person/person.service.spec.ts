import { HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

import { DbService } from '../db/db.service';
import { WcaService } from '../wca/wca.service';
import { PersonService } from './person.service';

describe('PersonService', () => {
  let service: PersonService;
  let dbService: DbService;

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
          },
        },
        {
          provide: WcaService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<PersonService>(PersonService);
    dbService = module.get<DbService>(DbService);
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
});
