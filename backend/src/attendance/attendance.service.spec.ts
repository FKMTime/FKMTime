import { HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AppGateway } from '../app.gateway';
import { DbService } from '../db/db.service';
import { StaffActivityStatus, StaffRole } from '../generated/prisma/client';
import { AttendanceService, tagsClearedBy } from './attendance.service';

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
              findFirst: jest.fn(),
            },
            device: {
              findFirst: jest.fn(),
            },
            room: {
              findMany: jest.fn(),
            },
            competition: {
              findFirst: jest.fn().mockResolvedValue({ defaultLocale: 'en' }),
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
          replacedBy: { select: { id: true, name: true } },
        },
      });
    });
  });

  describe('getRoundStaffing', () => {
    it('checks assigned runners across the whole round, regardless of attendance status', async () => {
      jest
        .spyOn(dbService.staffActivity, 'findFirst')
        .mockResolvedValue({ id: 'runner-in-another-group' } as any);

      await expect(service.getRoundStaffing('333-r1')).resolves.toEqual({
        hasAssignedRunners: true,
      });
      expect(dbService.staffActivity.findFirst).toHaveBeenCalledWith({
        where: {
          groupId: { startsWith: '333-r1-g' },
          role: StaffRole.RUNNER,
          isAssigned: true,
        },
        select: { id: true },
      });
    });

    it('reports no assigned runners when none match the round', async () => {
      jest.spyOn(dbService.staffActivity, 'findFirst').mockResolvedValue(null);

      await expect(service.getRoundStaffing('333-r2')).resolves.toEqual({
        hasAssignedRunners: false,
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

    it.each([
      [StaffActivityStatus.PRESENT, 'present'],
      [StaffActivityStatus.LATE, 'late'],
      [StaffActivityStatus.REPLACED, 'replaced'],
    ])(
      'refuses to overwrite someone already %s in this role',
      async (status, word) => {
        const groupId = '333-r1-g1';
        const personData = { personId: 'person1', role: StaffRole.JUDGE };
        jest
          .spyOn(dbService.person, 'findUnique')
          .mockResolvedValue({ id: 'person1', name: 'John Doe' } as any);
        jest.spyOn(dbService.staffActivity, 'findFirst').mockResolvedValue({
          id: 'attendance1',
          groupId,
          personId: 'person1',
          role: StaffRole.JUDGE,
          status,
        } as any);
        const upsert = jest.spyOn(dbService.staffActivity, 'upsert');

        await expect(
          service.addNotAssignedPerson(groupId, personData),
        ).rejects.toMatchObject({
          message: `This person is already marked as ${word} in this role in this group.`,
          status: HttpStatus.CONFLICT,
        });
        expect(upsert).not.toHaveBeenCalled();
      },
    );

    it('marks someone absent in this role as present', async () => {
      const groupId = '333-r1-g1';
      const personData = { personId: 'person1', role: StaffRole.JUDGE };
      jest
        .spyOn(dbService.person, 'findUnique')
        .mockResolvedValue({ id: 'person1', name: 'John Doe' } as any);
      const findFirst = jest
        .spyOn(dbService.staffActivity, 'findFirst')
        .mockResolvedValue(null);
      const upsert = jest
        .spyOn(dbService.staffActivity, 'upsert')
        .mockResolvedValue({ id: 'attendance1' } as any);
      jest.spyOn(appGateway, 'handleNewAttendance').mockImplementation();

      await service.addNotAssignedPerson(groupId, personData);

      // An absent row doesn't block; the upsert flips it to present
      expect(findFirst).toHaveBeenCalledWith({
        where: {
          groupId,
          personId: 'person1',
          role: StaffRole.JUDGE,
          status: { not: StaffActivityStatus.ABSENT },
        },
      });
      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            status: StaffActivityStatus.PRESENT,
          }),
        }),
      );
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
        include: {
          device: true,
          replacedBy: { select: { id: true, name: true } },
        },
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
        data: {
          status: StaffActivityStatus.PRESENT,
          noShow: false,
          replacedById: null,
        },
      });
      expect(appGateway.handleNewAttendance).toHaveBeenCalledWith(
        '333-r1-g1',
        'person1',
      );
    });
  });

  describe('getMostMissedAssignments', () => {
    const absent = (groupId: string, noShow = false) => ({
      id: groupId,
      personId: 'person1',
      groupId,
      role: StaffRole.JUDGE,
      status: StaffActivityStatus.ABSENT,
      leftEarly: false,
      noShow,
      comment: null,
    });

    it('does not count an assignment as missed before its group happens', async () => {
      jest
        .spyOn(dbService.person, 'findMany')
        .mockResolvedValue([{ id: 'person1', name: 'John Doe' }] as any);
      jest
        .spyOn(dbService.staffActivity, 'findMany')
        .mockImplementation(((args?: { distinct?: string[] }) =>
          Promise.resolve(
            args?.distinct
              ? []
              : [
                  absent('333-r1-g1'),
                  absent('333-r1-g2'),
                  absent('333-r1-g3', true),
                ],
          )) as any);
      jest
        .spyOn(dbService.room, 'findMany')
        .mockResolvedValue([
          { startedGroupIds: ['333-r1-g1'], currentGroupIds: ['333-r1-g2'] },
        ] as any);

      const [result] = await service.getMostMissedAssignments();

      expect(result.missedAssignments.map((a) => a.groupId)).toEqual([
        '333-r1-g1',
        '333-r1-g2',
      ]);
      expect(result.missedAssignmentsCount).toBe(2);
      // Not coming is known in advance, so it still shows
      expect(result.noShowAssignments.map((a) => a.groupId)).toEqual([
        '333-r1-g3',
      ]);
    });
  });

  describe('tagsClearedBy', () => {
    it('clears the no-show and replacement of someone who did the job', () => {
      for (const status of [
        StaffActivityStatus.PRESENT,
        StaffActivityStatus.LATE,
      ]) {
        expect(tagsClearedBy(status)).toEqual({
          noShow: false,
          replacedById: null,
        });
      }
    });

    it('keeps the replacement of someone replaced, and nothing else', () => {
      expect(tagsClearedBy(StaffActivityStatus.REPLACED)).toEqual({
        leftEarly: false,
        noShow: false,
      });
    });

    it('keeps the no-show and replacement of someone absent', () => {
      expect(tagsClearedBy(StaffActivityStatus.ABSENT)).toEqual({
        leftEarly: false,
      });
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

  describe('createAttendance', () => {
    it('announces a device scan only after saving it', async () => {
      jest.spyOn(dbService.device, 'findFirst').mockResolvedValue({
        id: 'device1',
        type: 'ATTENDANCE_SCRAMBLER',
        room: { currentGroupIds: ['333-r1-g1'] },
      } as any);
      jest.spyOn(dbService.person, 'findFirst').mockResolvedValue({
        id: 'person1',
        countryIso2: 'PL',
      } as any);
      const upsert = jest
        .spyOn(dbService.staffActivity, 'upsert')
        .mockResolvedValue({} as any);
      const announce = jest
        .spyOn(appGateway, 'handleNewAttendance')
        .mockImplementation();

      await service.createAttendance({ espId: 1, cardId: 123 } as any);

      expect(announce).toHaveBeenCalledWith('333-r1-g1', 'person1');
      expect(upsert.mock.invocationCallOrder[0]).toBeLessThan(
        announce.mock.invocationCallOrder[0],
      );
    });

    it('replies with an error for a device it does not know', async () => {
      jest.spyOn(dbService.device, 'findFirst').mockResolvedValue(null);

      const reply = await service.createAttendance({
        espId: 1,
        cardId: 123,
      } as any);

      expect(reply).toEqual(
        expect.objectContaining({
          error: true,
          status: 404,
          message: 'Station not found',
          errorDetails: { key: 'stationNotFound' },
        }),
      );
      expect(dbService.staffActivity.upsert).not.toHaveBeenCalled();
    });

    it('replies with an error, in the default language, for an unassigned card', async () => {
      jest.spyOn(dbService.device, 'findFirst').mockResolvedValue({
        id: 'device1',
        type: 'ATTENDANCE_JUDGE',
        room: { currentGroupIds: ['333-r1-g1'] },
      } as any);
      jest.spyOn(dbService.person, 'findFirst').mockResolvedValue(null);

      const reply = await service.createAttendance({
        espId: 1,
        cardId: 123,
      } as any);

      expect(reply).toEqual(
        expect.objectContaining({
          error: true,
          status: 404,
          message: 'Competitor not found',
          errorDetails: { key: 'competitorNotFound', cardId: 123 },
        }),
      );
      expect(dbService.staffActivity.upsert).not.toHaveBeenCalled();
    });

    it('replies with an error when the room has no group running', async () => {
      jest.spyOn(dbService.device, 'findFirst').mockResolvedValue({
        id: 'device1',
        type: 'ATTENDANCE_JUDGE',
        room: { currentGroupIds: [] },
      } as any);
      jest.spyOn(dbService.person, 'findFirst').mockResolvedValue({
        id: 'person1',
        countryIso2: 'PL',
      } as any);

      const reply = await service.createAttendance({
        espId: 1,
        cardId: 123,
      } as any);

      expect(reply).toEqual(
        expect.objectContaining({
          error: true,
          errorDetails: { key: 'noGroups', cardId: 123 },
        }),
      );
    });

    it('does not announce a scan that failed to save', async () => {
      jest.spyOn(dbService.device, 'findFirst').mockResolvedValue({
        id: 'device1',
        type: 'ATTENDANCE_JUDGE',
        room: { currentGroupIds: ['333-r1-g1'] },
      } as any);
      jest.spyOn(dbService.person, 'findFirst').mockResolvedValue({
        id: 'person1',
        countryIso2: 'PL',
      } as any);
      jest
        .spyOn(dbService.staffActivity, 'upsert')
        .mockRejectedValue(new Error('database down'));
      const announce = jest
        .spyOn(appGateway, 'handleNewAttendance')
        .mockImplementation();

      await expect(
        service.createAttendance({ espId: 1, cardId: 123 } as any),
      ).rejects.toThrow('database down');

      expect(announce).not.toHaveBeenCalled();
    });
  });

  describe('competitor not coming', () => {
    it('takes back "not coming" from a competitor who turned up', async () => {
      jest
        .spyOn(dbService.staffActivity, 'upsert')
        .mockResolvedValue({} as any);

      await service.markCompetitorAsPresent('competitor1', '333-r1-g1');

      expect(dbService.staffActivity.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ noShow: false }),
        }),
      );
    });
  });

  describe('setNoShow', () => {
    beforeEach(() => {
      jest
        .spyOn(dbService.staffActivity, 'updateMany')
        .mockResolvedValue({ count: 1 });
    });

    it("tags only staffing by default, never a competitor's row", async () => {
      await service.setNoShow({
        personId: 'person1',
        groupIds: ['333-r1-g1', '333-r1-g2'],
        noShow: true,
      });

      expect(dbService.staffActivity.updateMany).toHaveBeenCalledWith({
        where: {
          personId: 'person1',
          groupId: { in: ['333-r1-g1', '333-r1-g2'] },
          role: { not: StaffRole.COMPETITOR },
          status: StaffActivityStatus.ABSENT,
        },
        data: { noShow: true },
      });
    });

    it("tags only the competitor's absent rows when asked for them", async () => {
      await service.setNoShow({
        personId: 'person1',
        groupIds: ['333-r1-g1'],
        noShow: true,
        role: StaffRole.COMPETITOR,
      });

      expect(dbService.staffActivity.updateMany).toHaveBeenCalledWith({
        where: {
          personId: 'person1',
          groupId: { in: ['333-r1-g1'] },
          role: StaffRole.COMPETITOR,
          status: StaffActivityStatus.ABSENT,
        },
        data: { noShow: true },
      });
      expect(appGateway.handleNewAttendance).toHaveBeenCalledWith(
        '333-r1-g1',
        'person1',
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
