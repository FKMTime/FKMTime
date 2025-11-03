import { HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AttemptStatus } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

import { DbService } from '../db/db.service';
import { IncidentService } from './incident.service';

describe('IncidentService', () => {
  let service: IncidentService;
  let dbService: DbService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncidentService,
        {
          provide: DbService,
          useValue: {
            attempt: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
            },
            noteworthyIncident: {
              create: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            warning: {
              create: jest.fn(),
              findMany: jest.fn(),
              delete: jest.fn(),
            },
            manualIncident: {
              create: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<IncidentService>(IncidentService);
    dbService = module.get<DbService>(DbService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addAttemptAsNoteworthyIncident', () => {
    it('should add attempt as noteworthy incident', async () => {
      const attemptId = 'attempt1';
      const userId = 'user1';
      const mockAttempt = {
        id: attemptId,
        comment: 'Test comment',
        result: {
          roundId: '333-r1',
          person: { name: 'John Doe' },
        },
      };

      jest
        .spyOn(dbService.attempt, 'findUnique')
        .mockResolvedValue(mockAttempt as any);
      jest
        .spyOn(dbService.noteworthyIncident, 'create')
        .mockResolvedValue({} as any);

      await service.addAttemptAsNoteworthyIncident(attemptId, userId);

      expect(dbService.noteworthyIncident.create).toHaveBeenCalled();
    });

    it('should throw error if attempt not found', async () => {
      const attemptId = 'nonexistent';
      const userId = 'user1';

      jest.spyOn(dbService.attempt, 'findUnique').mockResolvedValue(null);

      await expect(
        service.addAttemptAsNoteworthyIncident(attemptId, userId),
      ).rejects.toThrow(HttpException);
    });

    it('should throw error if attempt is already marked as noteworthy', async () => {
      const attemptId = 'attempt1';
      const userId = 'user1';
      const mockAttempt = {
        id: attemptId,
        comment: 'Test comment',
        result: {
          roundId: '333-r1',
          person: { name: 'John Doe' },
        },
      };

      const prismaError = new PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '5.0.0',
        },
      );

      jest
        .spyOn(dbService.attempt, 'findUnique')
        .mockResolvedValue(mockAttempt as any);
      jest
        .spyOn(dbService.noteworthyIncident, 'create')
        .mockRejectedValue(prismaError);

      await expect(
        service.addAttemptAsNoteworthyIncident(attemptId, userId),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('getUnresolvedIncidents', () => {
    it('should return unresolved incidents', async () => {
      const mockIncidents = [
        { id: 'incident1', status: AttemptStatus.UNRESOLVED },
      ];
      jest
        .spyOn(dbService.attempt, 'findMany')
        .mockResolvedValue(mockIncidents as any);

      const result = await service.getUnresolvedIncidents();

      expect(result).toEqual(mockIncidents);
      expect(dbService.attempt.findMany).toHaveBeenCalledWith({
        where: { status: AttemptStatus.UNRESOLVED },
        include: expect.any(Object),
      });
    });
  });

  describe('getResolvedIncidents', () => {
    it('should return resolved incidents', async () => {
      const mockIncidents = [
        { id: 'incident1', status: AttemptStatus.RESOLVED },
      ];
      jest
        .spyOn(dbService.attempt, 'findMany')
        .mockResolvedValue(mockIncidents as any);

      const result = await service.getResolvedIncidents();

      expect(result).toEqual(mockIncidents);
    });

    it('should filter by search term', async () => {
      const mockIncidents = [];
      jest
        .spyOn(dbService.attempt, 'findMany')
        .mockResolvedValue(mockIncidents as any);

      await service.getResolvedIncidents('John');

      expect(dbService.attempt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            result: expect.any(Object),
          }),
        }),
      );
    });
  });

  describe('getUnresolvedIncidentsCount', () => {
    it('should return count of unresolved incidents', async () => {
      jest.spyOn(dbService.attempt, 'count').mockResolvedValue(5);

      const result = await service.getUnresolvedIncidentsCount();

      expect(result).toEqual({ count: 5 });
      expect(dbService.attempt.count).toHaveBeenCalledWith({
        where: { status: AttemptStatus.UNRESOLVED },
      });
    });
  });

  describe('createNoteworthyIncident', () => {
    it('should create a noteworthy incident', async () => {
      const incidentData = {
        title: 'Test Incident',
        description: 'Test description',
      };
      const userId = 'user1';
      const mockIncident = { id: 'incident1', ...incidentData };

      jest
        .spyOn(dbService.noteworthyIncident, 'create')
        .mockResolvedValue(mockIncident as any);

      const result = await service.createNoteworthyIncident(
        incidentData,
        userId,
      );

      expect(result).toEqual(mockIncident);
      expect(dbService.noteworthyIncident.create).toHaveBeenCalled();
    });
  });

  describe('updateNoteworthyIncident', () => {
    it('should update a noteworthy incident', async () => {
      const incidentId = 'incident1';
      const updateData = {
        title: 'Updated Title',
        description: 'Updated description',
      };
      const mockUpdated = { id: incidentId, ...updateData };

      jest
        .spyOn(dbService.noteworthyIncident, 'update')
        .mockResolvedValue(mockUpdated as any);

      const result = await service.updateNoteworthyIncident(
        incidentId,
        updateData,
      );

      expect(result).toEqual(mockUpdated);
      expect(dbService.noteworthyIncident.update).toHaveBeenCalledWith({
        where: { id: incidentId },
        data: updateData,
      });
    });
  });

  describe('deleteNoteworthyIncident', () => {
    it('should delete a noteworthy incident', async () => {
      const incidentId = 'incident1';

      jest
        .spyOn(dbService.noteworthyIncident, 'delete')
        .mockResolvedValue({} as any);

      await service.deleteNoteworthyIncident(incidentId);

      expect(dbService.noteworthyIncident.delete).toHaveBeenCalledWith({
        where: { id: incidentId },
      });
    });
  });

  describe('issueWarning', () => {
    it('should issue a warning', async () => {
      const personId = 'person1';
      const warningData = { description: 'Test warning' };
      const userId = 'user1';
      const mockWarning = { id: 'warning1', ...warningData };

      jest
        .spyOn(dbService.warning, 'create')
        .mockResolvedValue(mockWarning as any);

      const result = await service.issueWarning(personId, warningData, userId);

      expect(result).toEqual(mockWarning);
      expect(dbService.warning.create).toHaveBeenCalled();
    });
  });

  describe('deleteWarning', () => {
    it('should delete a warning', async () => {
      const warningId = 'warning1';

      jest.spyOn(dbService.warning, 'delete').mockResolvedValue({} as any);

      await service.deleteWarning(warningId);

      expect(dbService.warning.delete).toHaveBeenCalledWith({
        where: { id: warningId },
      });
    });
  });

  describe('createManualIncident', () => {
    it('should create a manual incident', async () => {
      const incidentData = {
        personId: 'person1',
        roundId: '333-r1',
        attempt: '1',
        description: 'Test incident',
      };
      const userId = 'user1';
      const mockIncident = { id: 'incident1', ...incidentData };

      jest
        .spyOn(dbService.manualIncident, 'create')
        .mockResolvedValue(mockIncident as any);

      const result = await service.createManualIncident(incidentData, userId);

      expect(result).toEqual(mockIncident);
      expect(dbService.manualIncident.create).toHaveBeenCalled();
    });
  });

  describe('updateManualIncident', () => {
    it('should update a manual incident', async () => {
      const incidentId = 'incident1';
      const updateData = {
        personId: 'person1',
        roundId: '333-r1',
        attempt: '2',
        description: 'Updated incident',
      };
      const mockUpdated = { id: incidentId, ...updateData };

      jest
        .spyOn(dbService.manualIncident, 'update')
        .mockResolvedValue(mockUpdated as any);

      const result = await service.updateManualIncident(incidentId, updateData);

      expect(result).toEqual(mockUpdated);
      expect(dbService.manualIncident.update).toHaveBeenCalledWith({
        where: { id: incidentId },
        data: expect.objectContaining(updateData),
      });
    });
  });

  describe('deleteManualIncident', () => {
    it('should delete a manual incident', async () => {
      const incidentId = 'incident1';

      jest
        .spyOn(dbService.manualIncident, 'delete')
        .mockResolvedValue({} as any);

      await service.deleteManualIncident(incidentId);

      expect(dbService.manualIncident.delete).toHaveBeenCalledWith({
        where: { id: incidentId },
      });
    });
  });
});
