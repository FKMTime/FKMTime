import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { DeviceDto } from './dto/device.dto';
import { UpdateBatteryPercentageDto } from './dto/updateBatteryPercentage.dto';
import { DeviceGateway } from './device.gateway';

@Injectable()
export class DeviceService {
  constructor(
    private readonly prisma: DbService,
    private readonly deviceGateway: DeviceGateway,
  ) {}

  async getAllDevices() {
    const devices = await this.prisma.device.findMany({
      include: {
        room: true,
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
    await this.prisma.device.update({
      where: { espId: data.espId },
      data: {
        batteryPercentage: data.batteryPercentage,
      },
    });
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
