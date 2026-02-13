import { Test, TestingModule } from '@nestjs/testing';

import { DbService } from '../db/db.service';
import { WcaService } from '../wca/wca.service';
import { ContestsService } from './contests.service';

describe('ContestsService', () => {
  let service: ContestsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContestsService,
        {
          provide: DbService,
          useValue: {
            competition: {
              findFirst: jest.fn(),
            },
          },
        },
        {
          provide: WcaService,
          useValue: {
            getAttemptsToEnterToWcaLive: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ContestsService>(ContestsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('mapResults', () => {
    it('should map results correctly', () => {
      const results = [
        {
          wcaId: 'WCA123',
          attempts: [{ result: 1234 }, { result: 1345 }],
        },
      ];

      const mapped = service['mapResults'](results);

      expect(mapped).toEqual([
        {
          wcaId: 'WCA123',
          attempts: [{ result: 1234 }, { result: 1345 }],
        },
      ]);
    });
  });

  describe('mapAttempts', () => {
    it('should map attempts correctly', () => {
      const attempts = [{ result: 1234 }, { result: 1345 }, { result: 1456 }];

      const mapped = service['mapAttempts'](attempts);

      expect(mapped).toEqual([
        { result: 1234 },
        { result: 1345 },
        { result: 1456 },
      ]);
    });
  });
});
