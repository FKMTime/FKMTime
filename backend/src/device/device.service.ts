import { forwardRef, HttpException, Inject, Injectable } from '@nestjs/common';
import { DeviceType } from '@prisma/client';
import { AppGateway } from 'src/app.gateway';

import { DbService } from '../db/db.service';
import { SocketController } from '../socket/socket.controller';
import { DeviceDto } from './dto/device.dto';
import { RequestToConnectDto } from './dto/requestToConnect.dto';
import { UpdateBatteryPercentageDto } from './dto/updateBatteryPercentage.dto';

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
    const transactions = [];

    for (const device of devices) {
      transactions.push(
        this.prisma.attempt.count({
          where: {
            deviceId: device.id,
          },
        }),
      );
    }
    const counts = await Promise.all(transactions);
    return devices.map((device, index) => ({
      ...device,
      count: counts[index],
    }));
  }

  async createDevice(data: DeviceDto) {
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
}
