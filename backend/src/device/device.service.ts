import { forwardRef, HttpException, Inject, Injectable } from '@nestjs/common';
import { DeviceType } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { AppGateway } from 'src/app.gateway';

import { DbService } from '../db/db.service';
import { SocketController } from '../socket/socket.controller';
import { DeviceDto } from './dto/device.dto';
import { RequestToConnectDto } from './dto/requestToConnect.dto';
import { UpdateBatteryPercentageDto } from './dto/updateBatteryPercentage.dto';
import { UploadFirmwareDto } from './dto/uploadFirmware.dto';

@Injectable()
export class DeviceService {
  constructor(
    private readonly prisma: DbService,
    private readonly appGateway: AppGateway,
    @Inject(forwardRef(() => SocketController))
    private readonly socketController: SocketController,
  ) {}

  async getAllDevices(type?: DeviceType, roomId?: string) {
    if (type && !Object.values(DeviceType).includes(type)) {
      throw new HttpException('Invalid device type', 400);
    }
    const whereParams = {};
    if (type) {
      whereParams['type'] = type;
    }
    if (roomId) {
      whereParams['roomId'] = roomId;
    }
    const devices = await this.prisma.device.findMany({
      include: {
        room: true,
      },
      where: whereParams,
      orderBy: {
        name: 'asc',
      },
    });
    const attemptsByDevice = await this.prisma.attempt.groupBy({
      by: ['deviceId'],
      _count: {
        _all: true,
      },
    });

    return devices.map((device) => ({
      ...device,
      count:
        attemptsByDevice.find((a) => a.deviceId === device.id)?._count?._all ||
        0,
    }));
  }

  async createDevice(data: DeviceDto) {
    try {
      await this.prisma.device.create({
        data: {
          name: data.name,
          espId: data.espId,
          type: data.type,
          room: {
            connect: {
              id: data.roomId,
            },
          },
        },
      });
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError) {
        if (e.code === 'P2002') {
          throw new HttpException(
            {
              message: 'Device with this name or ESP ID already exists',
            },
            409,
          );
        }
      }
    }
    this.appGateway.handleAddDeviceToDb(data.espId);
    await this.socketController.sendServerStatus();
    return {
      message: 'Device created',
    };
  }

  async getDeviceByEspId(espId: number, type: DeviceType) {
    return this.prisma.device.findFirst({
      where: {
        espId: espId,
        type: type,
      },
      include: {
        room: true,
      },
    });
  }

  async requestToConnect(data: RequestToConnectDto) {
    const inInDb = await this.prisma.device.findFirst({
      where: {
        espId: data.espId,
      },
    });
    if (inInDb) {
      return {
        message: 'Device already exists in database',
        status: 409,
        error: true,
      };
    }
    this.appGateway.handleDeviceRequest(data);
    return {
      message: 'Request sent',
      status: 200,
      error: false,
    };
  }

  async updateDevice(id: string, data: DeviceDto) {
    try {
      await this.prisma.device.update({
        where: { id },
        data: {
          name: data.name,
          espId: data.espId,
          type: data.type,
          room: {
            connect: {
              id: data.roomId,
            },
          },
        },
      });
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError) {
        if (e.code === 'P2002') {
          throw new HttpException(
            {
              message: 'Device with this name or ESP ID already exists',
            },
            409,
          );
        }
      }
    }
    await this.socketController.sendServerStatus();
    this.appGateway.handleDeviceUpdated();
    return {
      message: 'Device updated',
    };
  }

  async updateBatteryPercentage(data: UpdateBatteryPercentageDto) {
    try {
      await this.prisma.device.update({
        where: { espId: data.espId },
        data: {
          batteryPercentage: data.batteryPercentage,
        },
      });
    } catch (error) {
      return {
        message: 'Device not found',
        status: 404,
        error: true,
      };
    }
    this.appGateway.handleDeviceUpdated();
    return {
      message: 'Battery percentage updated',
      status: 200,
      error: false,
    };
  }

  async deleteDevice(id: string) {
    await this.prisma.device.delete({
      where: { id },
    });
    this.appGateway.handleDeviceUpdated();
    await this.socketController.sendServerStatus();
    return {
      message: 'Device deleted',
    };
  }

  async uploadFirmware(data: UploadFirmwareDto) {
    this.socketController.sendFirmware(data.fileName, data.fileData);
  }
}
