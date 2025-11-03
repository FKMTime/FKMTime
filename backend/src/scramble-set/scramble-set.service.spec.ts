import { HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { DbService } from '../db/db.service';
import { ScrambleSetService } from './scramble-set.service';

describe('ScrambleSetService', () => {
  let service: ScrambleSetService;
  let dbService: DbService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScrambleSetService,
        {
          provide: DbService,
          useValue: {
            scrambleSet: {
              create: jest.fn(),
              findMany: jest.fn(),
              delete: jest.fn(),
              deleteMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<ScrambleSetService>(ScrambleSetService);
    dbService = module.get<DbService>(DbService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('importScrambles', () => {
    it('should import scrambles successfully', async () => {
      const importData = {
        scrambleSets: [
          {
            roundId: '333-r1',
            set: 'A',
            scrambles: [
              { num: 1, encryptedScramble: 'encrypted1', isExtra: false },
              { num: 2, encryptedScramble: 'encrypted2', isExtra: false },
            ],
          },
        ],
      };

      jest.spyOn(dbService.scrambleSet, 'create').mockResolvedValue({} as any);

      const result = await service.importScrambles(importData);

      expect(result).toEqual({ message: 'Scrambles imported successfully' });
      expect(dbService.scrambleSet.create).toHaveBeenCalledWith({
        data: {
          roundId: '333-r1',
          set: 'A',
          scrambles: {
            create: [
              { num: 1, encryptedScramble: 'encrypted1', isExtra: false },
              { num: 2, encryptedScramble: 'encrypted2', isExtra: false },
            ],
          },
        },
      });
    });

    it('should throw error if scramble set already exists', async () => {
      const importData = {
        scrambleSets: [
          {
            roundId: '333-r1',
            set: 'A',
            scrambles: [
              { num: 1, encryptedScramble: 'encrypted1', isExtra: false },
            ],
          },
        ],
      };

      const prismaError = { code: 'P2002' };
      jest
        .spyOn(dbService.scrambleSet, 'create')
        .mockRejectedValue(prismaError);

      await expect(service.importScrambles(importData)).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('getScrambleSets', () => {
    it('should return scramble sets with counts', async () => {
      const mockSets = [
        {
          id: 'set1',
          roundId: '333-r1',
          set: 'A',
          scrambles: [
            {
              id: 's1',
              num: 1,
              encryptedScramble: 'encrypted1',
              isExtra: false,
            },
            {
              id: 's2',
              num: 2,
              encryptedScramble: 'encrypted2',
              isExtra: false,
            },
            {
              id: 's3',
              num: 3,
              encryptedScramble: 'encrypted3',
              isExtra: true,
            },
          ],
        },
      ];

      jest
        .spyOn(dbService.scrambleSet, 'findMany')
        .mockResolvedValue(mockSets as any);

      const result = await service.getScrambleSets('333-r1');

      expect(result).toEqual([
        {
          id: 'set1',
          roundId: '333-r1',
          set: 'A',
          scramblesCount: 2,
          extraScramblesCount: 1,
          scrambles: undefined,
        },
      ]);
    });
  });

  describe('deleteScrambleSet', () => {
    it('should delete scramble set successfully', async () => {
      jest.spyOn(dbService.scrambleSet, 'delete').mockResolvedValue({} as any);

      const result = await service.deleteScrambleSet('set1');

      expect(result).toEqual({ message: 'Scramble set deleted successfully' });
      expect(dbService.scrambleSet.delete).toHaveBeenCalledWith({
        where: { id: 'set1' },
      });
    });

    it('should throw error if scramble set not found', async () => {
      const prismaError = { code: 'P2016' };
      jest
        .spyOn(dbService.scrambleSet, 'delete')
        .mockRejectedValue(prismaError);

      await expect(service.deleteScrambleSet('nonexistent')).rejects.toThrow(
        HttpException,
      );
    });
  });
});
