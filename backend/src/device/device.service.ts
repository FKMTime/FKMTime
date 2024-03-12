import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { DeviceDto } from './dto/device.dto';

@Injectable()
export class DeviceService {
  constructor(private readonly prisma: DbService) {}

  async getAllDevices() {
    return this.prisma.device.findMany({
      include: {
        room: true,
      },
    });
  }

  async createDevice(data: DeviceDto) {
    return this.prisma.device.create({
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

  async deleteDevice(id: string) {
    return this.prisma.device.delete({
      where: { id },
    });
  }
}
