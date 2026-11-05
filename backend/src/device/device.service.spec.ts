import { HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DeviceType, HardwareVersion, Prisma } from '@prisma/client';

import { AppGateway } from '../app.gateway';
import { DbService } from '../db/db.service';
import { SocketController } from '../socket/socket.controller';
import { DeviceService } from './device.service';

describe('DeviceService', () => {
  let service: DeviceService;
  let dbService: DbService;
  let appGateway: AppGateway;
  let socketController: SocketController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeviceService,
        {
          provide: DbService,
          useValue: {
            device: {
              findMany: jest.fn(),
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            attempt: {
              groupBy: jest.fn(),
              count: jest.fn().mockResolvedValue(0),
            },
            staffActivity: {
              count: jest.fn().mockResolvedValue(0),
            },
            attemptEditLog: {
              count: jest.fn().mockResolvedValue(0),
            },
          },
        },
        {
          provide: AppGateway,
          useValue: {
            handleAddDeviceToDb: jest.fn(),
            handleDeviceRequest: jest.fn(),
            handleDeviceUpdated: jest.fn(),
            getDeviceRequest: jest.fn(),
          },
        },
        {
          provide: SocketController,
          useValue: {
            sendServerStatus: jest.fn(),
            sendFirmware: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DeviceService>(DeviceService);
    dbService = module.get<DbService>(DbService);
    appGateway = module.get<AppGateway>(AppGateway);
    socketController = module.get<SocketController>(SocketController);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAllDevices', () => {
    it('should return all devices with attempt counts', async () => {
      const mockDevices = [
        {
          id: 'device1',
          name: 'Device 1',
          espId: 1,
          type: DeviceType.STATION,
          room: { id: 'room1', name: 'Room 1' },
        },
      ];
      const mockAttempts = [{ deviceId: 'device1', _count: { _all: 5 } }];

      jest
        .spyOn(dbService.device, 'findMany')
        .mockResolvedValue(mockDevices as any);
      (dbService.attempt.groupBy as jest.Mock) = jest
        .fn()
        .mockResolvedValue(mockAttempts);

      const result = await service.getAllDevices();

      expect(result).toEqual([{ ...mockDevices[0], count: 5 }]);
      expect(dbService.device.findMany).toHaveBeenCalled();
    });

    it('should filter by device type', async () => {
      const mockDevices = [];
      const mockAttempts = [];

      jest
        .spyOn(dbService.device, 'findMany')
        .mockResolvedValue(mockDevices as any);
      (dbService.attempt.groupBy as jest.Mock) = jest
        .fn()
        .mockResolvedValue(mockAttempts);

      await service.getAllDevices(DeviceType.STATION);

      expect(dbService.device.findMany).toHaveBeenCalledWith({
        include: { room: true },
        where: { retiredAt: null, type: DeviceType.STATION },
        orderBy: { name: 'asc' },
      });
    });

    it('should throw error for invalid device type', async () => {
      await expect(service.getAllDevices('INVALID' as any)).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('createDevice', () => {
    it('should create a new device', async () => {
      const deviceData = {
        name: 'New Device',
        espId: 123,
        signKey: 456,
        type: DeviceType.STATION,
        roomId: 'room1',
        hwVersion: HardwareVersion.V4,
      };
      const createdDevice = {
        id: 'device1',
        ...deviceData,
        room: { id: 'room1', name: 'Room 1' },
      };

      jest
        .spyOn(dbService.device, 'create')
        .mockResolvedValue(createdDevice as any);
      jest.spyOn(appGateway, 'handleAddDeviceToDb').mockImplementation();
      jest.spyOn(socketController, 'sendServerStatus').mockResolvedValue();

      const result = await service.createDevice(deviceData);

      expect(result).toEqual({ ...createdDevice, count: 0 });
      expect(dbService.device.create).toHaveBeenCalled();
      expect(appGateway.handleAddDeviceToDb).toHaveBeenCalledWith(123);
      expect(socketController.sendServerStatus).toHaveBeenCalled();
    });

    it('should throw error if device with same name or ESP ID exists', async () => {
      const deviceData = {
        name: 'Duplicate Device',
        espId: 123,
        signKey: 456,
        type: DeviceType.STATION,
        roomId: 'room1',
        hwVersion: HardwareVersion.V4,
      };

      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '5.0.0',
        },
      );

      jest.spyOn(dbService.device, 'create').mockRejectedValue(prismaError);

      await expect(service.createDevice(deviceData)).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('getDeviceByEspId', () => {
    it('should return device by ESP ID and type', async () => {
      const mockDevice = {
        id: 'device1',
        espId: 123,
        type: DeviceType.STATION,
        room: { id: 'room1', name: 'Room 1' },
      };

      jest
        .spyOn(dbService.device, 'findFirst')
        .mockResolvedValue(mockDevice as any);

      const result = await service.getDeviceByEspId(123, DeviceType.STATION);

      expect(result).toEqual(mockDevice);
      expect(dbService.device.findFirst).toHaveBeenCalledWith({
        where: { espId: 123, type: DeviceType.STATION, retiredAt: null },
        include: { room: true },
      });
    });
  });

  describe('requestToConnect', () => {
    it('should send request if device not in database', async () => {
      const requestData = {
        espId: 456,
        signKey: 789,
        type: 'STATION' as any,
        hw: 'v4',
      };

      jest.spyOn(dbService.device, 'findFirst').mockResolvedValue(null);
      jest.spyOn(appGateway, 'handleDeviceRequest').mockImplementation();

      const result = await service.requestToConnect(requestData);

      expect(result).toEqual({
        message: 'Request sent',
        status: 200,
        error: false,
      });
      expect(appGateway.handleDeviceRequest).toHaveBeenCalledWith(requestData);
    });

    it('should return error if the device is already paired with this key', async () => {
      const requestData = {
        espId: 123,
        signKey: 789,
        type: 'STATION' as any,
        hw: 'v4',
      };
      const mockDevice = {
        id: 'device1',
        espId: 123,
        signKey: 789,
        retiredAt: null,
      };

      jest
        .spyOn(dbService.device, 'findFirst')
        .mockResolvedValue(mockDevice as any);

      const result = await service.requestToConnect(requestData);

      expect(result).toEqual({
        message: 'Device already exists in database',
        status: 409,
        error: true,
      });
      expect(appGateway.handleDeviceRequest).not.toHaveBeenCalled();
    });

    it('should queue a reconnect request when a known device has a new sign key', async () => {
      const requestData = {
        espId: 123,
        signKey: 999,
        type: 'STATION' as any,
        hw: 'v4',
      };
      jest.spyOn(dbService.device, 'findFirst').mockResolvedValue({
        id: 'device1',
        name: 'Station 1',
        espId: 123,
        signKey: 789,
        retiredAt: null,
      } as any);

      const result = await service.requestToConnect(requestData);

      expect(result.status).toBe(200);
      expect(appGateway.handleDeviceRequest).toHaveBeenCalledWith({
        ...requestData,
        existingDevice: { id: 'device1', name: 'Station 1' },
      });
    });

    it('should queue a reconnect request when a retired device asks again', async () => {
      const requestData = {
        espId: 123,
        signKey: 789,
        type: 'STATION' as any,
        hw: 'v4',
      };
      jest.spyOn(dbService.device, 'findFirst').mockResolvedValue({
        id: 'device1',
        name: 'Station 1',
        espId: 123,
        signKey: 789,
        retiredAt: new Date(),
      } as any);

      await service.requestToConnect(requestData);

      expect(appGateway.handleDeviceRequest).toHaveBeenCalledWith({
        ...requestData,
        existingDevice: { id: 'device1', name: 'Station 1' },
      });
    });
  });

  describe('reconnectDevice', () => {
    it('should store the new sign key on the existing device and restore it', async () => {
      jest.spyOn(dbService.device, 'findUnique').mockResolvedValue({
        id: 'device1',
        espId: 123,
      } as any);
      jest.spyOn(appGateway, 'getDeviceRequest').mockReturnValue({
        espId: 123,
        signKey: 999,
        type: 'STATION' as any,
        hw: 'v4',
      });

      await service.reconnectDevice('device1');

      expect(dbService.device.update).toHaveBeenCalledWith({
        where: { id: 'device1' },
        data: { signKey: 999, retiredAt: null },
      });
      expect(appGateway.handleAddDeviceToDb).toHaveBeenCalledWith(123);
      expect(socketController.sendServerStatus).toHaveBeenCalled();
    });

    it('should refuse when the device has no pending request', async () => {
      jest.spyOn(dbService.device, 'findUnique').mockResolvedValue({
        id: 'device1',
        espId: 123,
      } as any);
      jest.spyOn(appGateway, 'getDeviceRequest').mockReturnValue(undefined);

      await expect(service.reconnectDevice('device1')).rejects.toThrow(
        HttpException,
      );
      expect(dbService.device.update).not.toHaveBeenCalled();
    });
  });

  describe('updateBatteryPercentage', () => {
    it('should update battery percentage', async () => {
      const updateData = { espId: 123, batteryPercentage: 85 };
      const mockDevice = { id: 'device1', espId: 123 };

      jest
        .spyOn(dbService.device, 'findFirst')
        .mockResolvedValue(mockDevice as any);
      jest.spyOn(dbService.device, 'update').mockResolvedValue({} as any);
      jest.spyOn(appGateway, 'handleDeviceUpdated').mockImplementation();

      const result = await service.updateBatteryPercentage(updateData);

      expect(result).toEqual({
        message: 'Battery percentage updated',
        status: 200,
        error: false,
      });
    });

    it('should return error if device not found', async () => {
      const updateData = { espId: 999, batteryPercentage: 85 };

      jest.spyOn(dbService.device, 'findFirst').mockResolvedValue(null);

      const result = await service.updateBatteryPercentage(updateData);

      expect(result).toEqual({
        message: 'Device not found',
        status: 404,
        error: true,
      });
    });
  });

  describe('deleteDevice', () => {
    it('should retire a device that recorded attempts instead of deleting it', async () => {
      (dbService.attempt.count as jest.Mock).mockResolvedValue(3);

      const result = await service.deleteDevice('device1');

      expect(result).toEqual({ message: 'Device retired' });
      expect(dbService.device.delete).not.toHaveBeenCalled();
      expect(dbService.device.update).toHaveBeenCalledWith({
        where: { id: 'device1' },
        data: { retiredAt: expect.any(Date) },
      });
    });

    it('should delete a device without history', async () => {
      jest.spyOn(dbService.device, 'delete').mockResolvedValue({} as any);
      jest.spyOn(appGateway, 'handleDeviceUpdated').mockImplementation();
      jest.spyOn(socketController, 'sendServerStatus').mockResolvedValue();

      const result = await service.deleteDevice('device1');

      expect(result).toEqual({ message: 'Device deleted' });
      expect(dbService.device.delete).toHaveBeenCalledWith({
        where: { id: 'device1' },
      });
      expect(appGateway.handleDeviceUpdated).toHaveBeenCalled();
      expect(socketController.sendServerStatus).toHaveBeenCalled();
    });
  });
});
