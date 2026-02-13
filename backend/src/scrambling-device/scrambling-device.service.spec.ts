import { HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { DbService } from '../db/db.service';
import { ScramblingDeviceService } from './scrambling-device.service';

describe('ScramblingDeviceService', () => {
  let service: ScramblingDeviceService;
  let dbService: DbService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScramblingDeviceService,
        {
          provide: DbService,
          useValue: {
            scramblingDevice: {
              findMany: jest.fn(),
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<ScramblingDeviceService>(ScramblingDeviceService);
    dbService = module.get<DbService>(DbService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getScramblingDevicesByRoom', () => {
    it('should return all scrambling devices', async () => {
      const mockDevices = [
        {
          id: 'device1',
          name: 'Device 1',
          room: { id: 'room1', name: 'Room 1' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      jest
        .spyOn(dbService.scramblingDevice, 'findMany')
        .mockResolvedValue(mockDevices as any);

      const result = await service.getScramblingDevicesByRoom();

      expect(result).toEqual(mockDevices);
      expect(dbService.scramblingDevice.findMany).toHaveBeenCalledWith({
        select: {
          id: true,
          name: true,
          room: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });
  });

  describe('createScramblingDevice', () => {
    it('should create a scrambling device', async () => {
      const deviceData = {
        name: 'New Device',
        roomId: 'room1',
      };
      const mockDevice = { id: 'device1', ...deviceData };

      jest
        .spyOn(dbService.scramblingDevice, 'create')
        .mockResolvedValue(mockDevice as any);

      const result = await service.createScramblingDevice(deviceData);

      expect(result).toEqual(mockDevice);
      expect(dbService.scramblingDevice.create).toHaveBeenCalledWith({
        data: deviceData,
      });
    });
  });

  describe('generateOneTimeCode', () => {
    it('should generate a one-time code', async () => {
      jest
        .spyOn(dbService.scramblingDevice, 'update')
        .mockResolvedValue({} as any);

      const result = await service.generateOneTimeCode('device1');

      expect(result).toHaveProperty('code');
      expect(result.code).toMatch(/^\d{6}$/);
      expect(dbService.scramblingDevice.update).toHaveBeenCalled();
    });
  });

  describe('getToken', () => {
    it('should return token for valid one-time code', async () => {
      const mockDevice = { id: 'device1', name: 'Device 1' };

      jest
        .spyOn(dbService.scramblingDevice, 'findFirst')
        .mockResolvedValue(mockDevice as any);
      jest
        .spyOn(dbService.scramblingDevice, 'update')
        .mockResolvedValue({} as any);

      const result = await service.getToken({ code: '123456' });

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('device');
      expect(result.device).toEqual(mockDevice);
    });

    it('should throw error for invalid one-time code', async () => {
      jest
        .spyOn(dbService.scramblingDevice, 'findFirst')
        .mockResolvedValue(null);

      await expect(service.getToken({ code: '999999' })).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('validateToken', () => {
    it('should return device for valid token', async () => {
      const mockDevice = { id: 'device1', name: 'Device 1' };

      jest
        .spyOn(dbService.scramblingDevice, 'findFirst')
        .mockResolvedValue(mockDevice as any);

      const result = await service.validateToken('valid-token');

      expect(result).toEqual(mockDevice);
    });

    it('should throw error for invalid token', async () => {
      jest
        .spyOn(dbService.scramblingDevice, 'findFirst')
        .mockResolvedValue(null);

      await expect(service.validateToken('invalid-token')).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('isTokenValid', () => {
    it('should return true for valid token', async () => {
      const mockDevice = { id: 'device1', name: 'Device 1' };

      jest
        .spyOn(dbService.scramblingDevice, 'findFirst')
        .mockResolvedValue(mockDevice as any);

      const result = await service.isTokenValid({ token: 'valid-token' });

      expect(result).toBe(true);
    });

    it('should return false for invalid token', async () => {
      jest
        .spyOn(dbService.scramblingDevice, 'findFirst')
        .mockResolvedValue(null);

      const result = await service.isTokenValid({ token: 'invalid-token' });

      expect(result).toBe(false);
    });
  });

  describe('updateScramblingDevice', () => {
    it('should update scrambling device', async () => {
      const updateData = { name: 'Updated Device', roomId: 'room2' };
      const mockUpdated = { id: 'device1', ...updateData };

      jest
        .spyOn(dbService.scramblingDevice, 'update')
        .mockResolvedValue(mockUpdated as any);

      const result = await service.updateScramblingDevice(
        'device1',
        updateData,
      );

      expect(result).toEqual(mockUpdated);
      expect(dbService.scramblingDevice.update).toHaveBeenCalledWith({
        where: { id: 'device1' },
        data: updateData,
      });
    });
  });

  describe('deleteScramblingDevice', () => {
    it('should delete scrambling device', async () => {
      jest
        .spyOn(dbService.scramblingDevice, 'delete')
        .mockResolvedValue({} as any);

      const result = await service.deleteScramblingDevice('device1');

      expect(result).toEqual({ message: 'Successfully deleted' });
      expect(dbService.scramblingDevice.delete).toHaveBeenCalledWith({
        where: { id: 'device1' },
      });
    });

    it('should throw error if device not found', async () => {
      const error = { code: 'P2025' };
      jest.spyOn(dbService.scramblingDevice, 'delete').mockRejectedValue(error);

      await expect(
        service.deleteScramblingDevice('nonexistent'),
      ).rejects.toThrow(HttpException);
    });
  });
});
