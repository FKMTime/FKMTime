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
});
