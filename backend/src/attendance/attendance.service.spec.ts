import { HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { StaffActivityStatus, StaffRole } from '@prisma/client';

import { AppGateway } from '../app.gateway';
import { DbService } from '../db/db.service';
import { AttendanceService } from './attendance.service';

describe('AttendanceService', () => {
  let service: AttendanceService;
  let dbService: DbService;
  let appGateway: AppGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        {
          provide: DbService,
          useValue: {
            staffActivity: {
              findMany: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
              upsert: jest.fn(),
              updateMany: jest.fn(),
            },
            person: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: AppGateway,
          useValue: {
            handleNewAttendance: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AttendanceService>(AttendanceService);
    dbService = module.get<DbService>(DbService);
    appGateway = module.get<AppGateway>(AppGateway);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAttendanceByGroupId', () => {
    it('should return attendance for a group', async () => {
      const mockAttendance = [
        {
          id: 'attendance1',
          groupId: '333-r1-g1',
          personId: 'person1',
          role: StaffRole.JUDGE,
          status: StaffActivityStatus.PRESENT,
        },
      ];

      jest
        .spyOn(dbService.staffActivity, 'findMany')
        .mockResolvedValue(mockAttendance as any);

      const result = await service.getAttendanceByGroupId('333-r1-g1');

      expect(result).toEqual(mockAttendance);
      expect(dbService.staffActivity.findMany).toHaveBeenCalledWith({
        where: { groupId: '333-r1-g1' },
        include: {
          person: true,
          device: true,
        },
      });
    });
  });

  describe('addNotAssignedPerson', () => {
    it('should add not assigned person successfully', async () => {
      const groupId = '333-r1-g1';
      const personData = {
        personId: 'person1',
        role: StaffRole.JUDGE,
      };
      const mockPerson = { id: 'person1', name: 'John Doe' };
      const mockAttendance = {
        id: 'attendance1',
        groupId,
        personId: 'person1',
        role: StaffRole.JUDGE,
        status: StaffActivityStatus.PRESENT,
      };

      jest
        .spyOn(dbService.person, 'findUnique')
        .mockResolvedValue(mockPerson as any);
      jest.spyOn(dbService.staffActivity, 'findFirst').mockResolvedValue(null);
      jest
        .spyOn(dbService.staffActivity, 'upsert')
        .mockResolvedValue(mockAttendance as any);
      jest.spyOn(appGateway, 'handleNewAttendance').mockImplementation();

      const result = await service.addNotAssignedPerson(groupId, personData);

      expect(result).toEqual(mockAttendance);
      expect(appGateway.handleNewAttendance).toHaveBeenCalledWith(
        groupId,
        'person1',
      );
    });

    it('should throw error if person not found', async () => {
      const groupId = '333-r1-g1';
      const personData = {
        personId: 'nonexistent',
        role: StaffRole.JUDGE,
      };

      jest.spyOn(dbService.person, 'findUnique').mockResolvedValue(null);

      await expect(
        service.addNotAssignedPerson(groupId, personData),
      ).rejects.toThrow(HttpException);
    });

    it('should throw error if person already marked as present in group', async () => {
      const groupId = '333-r1-g1';
      const personData = {
        personId: 'person1',
        role: StaffRole.JUDGE,
      };
      const mockPerson = { id: 'person1', name: 'John Doe' };
      const existingAttendance = {
        id: 'attendance1',
        groupId,
        personId: 'person1',
        role: StaffRole.JUDGE,
        status: StaffActivityStatus.PRESENT,
      };

      jest
        .spyOn(dbService.person, 'findUnique')
        .mockResolvedValue(mockPerson as any);
      jest
        .spyOn(dbService.staffActivity, 'findFirst')
        .mockResolvedValue(existingAttendance as any);

      await expect(
        service.addNotAssignedPerson(groupId, personData),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('getStaffActivitiesByPersonId', () => {
    it('should return staff activities for a person', async () => {
      const mockActivities = [
        {
          id: 'activity1',
          groupId: '333-r1-g1',
          personId: 'person1',
          role: StaffRole.JUDGE,
        },
      ];

      jest
        .spyOn(dbService.staffActivity, 'findMany')
        .mockResolvedValue(mockActivities as any);

      const result = await service.getStaffActivitiesByPersonId('person1');

      expect(result).toEqual(mockActivities);
      expect(dbService.staffActivity.findMany).toHaveBeenCalledWith({
        where: { person: { id: 'person1' } },
        include: { device: true },
      });
    });
  });

  describe('markAsPresent', () => {
    it('should mark attendance as present', async () => {
      const mockAttendance = {
        id: 'attendance1',
        groupId: '333-r1-g1',
        personId: 'person1',
        status: StaffActivityStatus.PRESENT,
      };

      jest
        .spyOn(dbService.staffActivity, 'update')
        .mockResolvedValue(mockAttendance as any);
      jest.spyOn(appGateway, 'handleNewAttendance').mockImplementation();

      const result = await service.markAsPresent('attendance1');

      expect(result).toEqual(mockAttendance);
      expect(dbService.staffActivity.update).toHaveBeenCalledWith({
        where: { id: 'attendance1' },
        data: { status: StaffActivityStatus.PRESENT },
      });
      expect(appGateway.handleNewAttendance).toHaveBeenCalledWith(
        '333-r1-g1',
        'person1',
      );
    });
  });

  describe('markCompetitorAsPresent', () => {
    it('should mark competitor as present', async () => {
      jest
        .spyOn(dbService.staffActivity, 'upsert')
        .mockResolvedValue({} as any);
      jest.spyOn(appGateway, 'handleNewAttendance').mockImplementation();

      await service.markCompetitorAsPresent(
        'competitor1',
        '333-r1-g1',
        'device1',
      );

      expect(dbService.staffActivity.upsert).toHaveBeenCalled();
      expect(appGateway.handleNewAttendance).toHaveBeenCalledWith(
        '333-r1-g1',
        'competitor1',
      );
    });
  });

  describe('markJudgeAsPresent', () => {
    it('should mark judge as present', async () => {
      jest
        .spyOn(dbService.staffActivity, 'upsert')
        .mockResolvedValue({} as any);
      jest.spyOn(appGateway, 'handleNewAttendance').mockImplementation();

      await service.markJudgeAsPresent('judge1', '333-r1-g1', 'device1');

      expect(dbService.staffActivity.upsert).toHaveBeenCalled();
      expect(appGateway.handleNewAttendance).toHaveBeenCalledWith(
        '333-r1-g1',
        'judge1',
      );
    });
  });
});
