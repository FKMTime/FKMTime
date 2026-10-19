import { HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { DbService } from '../db/db.service';
import { SocketController } from '../socket/socket.controller';
import { RoomsService } from './rooms.service';

describe('RoomsService', () => {
  let service: RoomsService;
  let dbService: DbService;
  let socketController: SocketController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomsService,
        {
          provide: DbService,
          useValue: {
            room: {
              findMany: jest.fn(),
              update: jest.fn(),
            },
            competition: {
              findFirst: jest.fn(),
            },
            result: {
              findMany: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
        {
          provide: SocketController,
          useValue: {
            sendServerStatus: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RoomsService>(RoomsService);
    dbService = module.get<DbService>(DbService);
    socketController = module.get<SocketController>(SocketController);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAllRooms', () => {
    it('should return all rooms', async () => {
      const mockRooms = [
        { id: 'room1', name: 'Room 1', currentGroupIds: [] },
        { id: 'room2', name: 'Room 2', currentGroupIds: [] },
      ];

      jest
        .spyOn(dbService.room, 'findMany')
        .mockResolvedValue(mockRooms as any);

      const result = await service.getAllRooms();

      expect(result).toEqual(mockRooms);
      expect(dbService.room.findMany).toHaveBeenCalled();
    });
  });

  describe('updateRooms', () => {
    it('should update rooms successfully', async () => {
      const updateData = {
        rooms: [
          {
            id: 'room1',
            currentGroupIds: ['333-r1-g1', '222-r1-g1'],
          },
        ],
      };

      jest.spyOn(dbService, '$transaction').mockResolvedValue([]);
      jest.spyOn(socketController, 'sendServerStatus').mockResolvedValue();

      const result = await service.updateRooms(updateData);

      expect(result).toEqual({ message: 'Rooms updated' });
      expect(dbService.$transaction).toHaveBeenCalled();
      expect(socketController.sendServerStatus).toHaveBeenCalled();
    });

    it('should throw error if two groups from same round', async () => {
      const updateData = {
        rooms: [
          {
            id: 'room1',
            currentGroupIds: ['333-r1-g1', '333-r1-g2'],
          },
        ],
      };

      await expect(service.updateRooms(updateData)).rejects.toThrow(
        HttpException,
      );
    });

    it('should throw error if two groups from same event', async () => {
      const updateData = {
        rooms: [
          {
            id: 'room1',
            currentGroupIds: ['333-r1-g1', '333-r2-g1'],
          },
        ],
      };

      await expect(service.updateRooms(updateData)).rejects.toThrow(
        HttpException,
      );
    });
  });
  describe('getRoomsProgress', () => {
    it('reports progress for each current group of each room', async () => {
      const wcif = {
        events: [{ id: '333', rounds: [{ id: '333-r1', format: 'a' }] }],
        schedule: {
          venues: [
            {
              rooms: [
                {
                  activities: [
                    {
                      id: 1,
                      activityCode: '333-r1',
                      childActivities: [{ id: 11, activityCode: '333-r1-g1' }],
                    },
                  ],
                },
              ],
            },
          ],
        },
        persons: [
          {
            registrantId: 7,
            assignments: [{ activityId: 11, assignmentCode: 'competitor' }],
          },
        ],
      };
      jest.spyOn(dbService.room, 'findMany').mockResolvedValue([
        { id: 'room1', currentGroupIds: ['333-r1-g1'] },
        { id: 'room2', currentGroupIds: [] },
      ] as any);
      jest
        .spyOn(dbService.competition, 'findFirst')
        .mockResolvedValue({ wcif } as any);
      jest.spyOn(dbService.result, 'findMany').mockResolvedValue([
        {
          person: { registrantId: 7 },
          attempts: [
            {
              id: 'a1',
              attemptNumber: 1,
              replacedBy: null,
              type: 'STANDARD_ATTEMPT',
              status: 'STANDARD',
            },
          ],
        },
      ] as any);

      const progress = await service.getRoomsProgress();

      expect(progress).toEqual([
        {
          roomId: 'room1',
          groups: [
            {
              groupId: '333-r1-g1',
              roundId: '333-r1',
              competitors: 1,
              entered: 1,
              expected: 5,
            },
          ],
        },
        { roomId: 'room2', groups: [] },
      ]);
      expect(dbService.result.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            roundId: '333-r1',
            person: { registrantId: { in: [7] } },
          },
        }),
      );
    });

    it('returns nothing before a competition is imported', async () => {
      jest.spyOn(dbService.room, 'findMany').mockResolvedValue([]);
      jest.spyOn(dbService.competition, 'findFirst').mockResolvedValue(null);
      expect(await service.getRoomsProgress()).toEqual([]);
    });
  });
});
