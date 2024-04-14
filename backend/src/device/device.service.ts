import { HttpException, Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { DeviceDto } from './dto/device.dto';
import { UpdateBatteryPercentageDto } from './dto/updateBatteryPercentage.dto';
import { DeviceGateway } from './device.gateway';
import { RequestToConnectDto } from './dto/requestToConnect.dto';
import { DeviceType } from '@prisma/client';

@Injectable()
export class DeviceService {
  constructor(
    private readonly prisma: DbService,
    private readonly deviceGateway: DeviceGateway,
  ) {}

  async getAllDevices(type?: DeviceType) {
    if (type && !Object.values(DeviceType).includes(type)) {
      throw new HttpException('Invalid device type', 400);
    }
    const whereParams = type ? { type: type } : {};
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
    this.deviceGateway.handleAddDeviceToDb(data.espId);
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
      };
    }
    this.deviceGateway.handleDeviceRequest(data);
    return {
      message: 'Request sent',
    };
  }

  async updateDevice(id: string, data: DeviceDto) {
    return this.prisma.device.update({
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
      throw new HttpException('Device not found', 404);
    }
    this.deviceGateway.handleDeviceUpdated();
    return {
      message: 'Battery percentage updated',
    };
  }

  async deleteDevice(id: string) {
    return this.prisma.device.delete({
      where: { id },
    });
  }
}
