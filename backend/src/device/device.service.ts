import { forwardRef, HttpException, Inject, Injectable } from '@nestjs/common';
import { DeviceType, Prisma } from '@prisma/client';
import { AppGateway } from 'src/app.gateway';

import { DbService } from '../db/db.service';
import { SocketController } from '../socket/socket.controller';
import { LIVE_LOOKUP_TTL_MS, TtlCache } from '../ttl-cache';
import { DeviceDto } from './dto/device.dto';
import { DeviceConnectedDto } from './dto/deviceConnected.dto';
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

  private readonly stationsByEspId = new TtlCache<
    number,
    Awaited<ReturnType<DeviceService['getDeviceByEspId']>>
  >(LIVE_LOOKUP_TTL_MS);

  async getAllDevices(type?: DeviceType, roomId?: string) {
    if (type && !Object.values(DeviceType).includes(type)) {
      throw new HttpException('Invalid device type', 400);
    }
    const whereParams: Prisma.DeviceWhereInput = { retiredAt: null };
    if (type) {
      whereParams['type'] = type;
    }
    if (roomId && roomId !== 'ALL') {
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
    return this.withAttemptCounts(devices);
  }

  async getRetiredDevices() {
    const devices = await this.prisma.device.findMany({
      include: {
        room: true,
      },
      where: { retiredAt: { not: null } },
      orderBy: {
        name: 'asc',
      },
    });
    return this.withAttemptCounts(devices);
  }

  private async withAttemptCounts<T extends { id: string }>(devices: T[]) {
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
    let device;
    try {
      device = await this.prisma.device.create({
        data: {
          name: data.name,
          espId: data.espId,
          signKey: data.signKey,
          type: data.type,
          hwVersion: data.hwVersion,
          room: {
            connect: {
              id: data.roomId,
            },
          },
        },
        include: { room: true },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === 'P2002') {
          throw new HttpException(
            {
              message: 'Device with this name or ESP ID already exists',
            },
            409,
          );
        }
      }
      throw e;
    }
    this.stationsByEspId.clear();
    this.appGateway.handleAddDeviceToDb(data.espId);
    await this.socketController.sendServerStatus();
    return { ...device, count: 0 };
  }

  async getDeviceByEspId(espId: number, type: DeviceType) {
    return this.prisma.device.findFirst({
      where: {
        espId: espId,
        type: type,
        retiredAt: null,
      },
      include: {
        room: true,
      },
    });
  }

  /** getDeviceByEspId for a station, cached for live solving updates */
  async getStationByEspIdCached(espId: number) {
    return this.stationsByEspId.getOrLoad(espId, () =>
      this.getDeviceByEspId(espId, DeviceType.STATION),
    );
  }

  async requestToConnect(data: RequestToConnectDto) {
    const existing = await this.prisma.device.findFirst({
      where: {
        espId: data.espId,
      },
      omit: { signKey: false },
    });
    const isPaired =
      existing &&
      !existing.retiredAt &&
      (existing.signKey === null || existing.signKey === data.signKey);
    if (isPaired) {
      return {
        message: 'Device already exists in database',
        status: 409,
        error: true,
      };
    }
    // A reset device comes back with a new sign key, and a retired one asks again
    // when it is turned on. Both are reconnected to their existing row, so the
    // attempts they recorded keep their station
    this.appGateway.handleDeviceRequest(
      existing
        ? { ...data, existingDevice: { id: existing.id, name: existing.name } }
        : data,
    );
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
          hwVersion: data.hwVersion,
          room: {
            connect: {
              id: data.roomId,
            },
          },
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === 'P2002') {
          throw new HttpException(
            {
              message: 'Device with this name or ESP ID already exists',
            },
            409,
          );
        }
      }
      throw e;
    }
    this.stationsByEspId.clear();
    await this.socketController.sendServerStatus();
    this.appGateway.handleDeviceUpdated();
    return {
      message: 'Device updated',
    };
  }

  async updateBatteryPercentage(data: UpdateBatteryPercentageDto) {
    const device = await this.prisma.device.findFirst({
      where: {
        espId: data.espId,
      },
    });
    if (!device) {
      return {
        message: 'Device not found',
        status: 404,
        error: true,
      };
    }
    try {
      await this.prisma.device.update({
        where: { espId: data.espId },
        data: {
          batteryPercentage: data.batteryPercentage,
        },
      });
    } catch {
      return {
        message: 'Error updating battery percentage',
        status: 500,
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

  async updateFirmwareVersion(data: DeviceConnectedDto) {
    const device = await this.prisma.device.findFirst({
      where: {
        espId: data.espId,
      },
    });
    if (!device) {
      return {
        message: 'Device not found',
        status: 404,
        error: true,
      };
    }
    if (device.firmwareVersion !== data.firmwareVersion) {
      await this.prisma.device.update({
        where: { espId: data.espId },
        data: {
          firmwareVersion: data.firmwareVersion,
        },
      });
      this.appGateway.handleDeviceUpdated();
    }
    return {
      message: 'Firmware version updated',
      status: 200,
      error: false,
    };
  }

  /** Approves a pending connect request from a device already in the database */
  async reconnectDevice(id: string) {
    const device = await this.prisma.device.findUnique({ where: { id } });
    if (!device) {
      throw new HttpException({ message: 'Device not found' }, 404);
    }
    const request =
      device.espId !== null
        ? this.appGateway.getDeviceRequest(device.espId)
        : undefined;
    if (!request) {
      throw new HttpException(
        { message: 'This device has no pending connect request' },
        404,
      );
    }
    try {
      await this.prisma.device.update({
        where: { id },
        data: { signKey: request.signKey, retiredAt: null },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new HttpException(
          { message: 'Another device already uses this sign key' },
          409,
        );
      }
      throw e;
    }
    this.appGateway.handleAddDeviceToDb(device.espId);
    await this.notifyDevicesChanged();
    return { message: 'Device reconnected' };
  }

  async restoreDevice(id: string) {
    await this.prisma.device.update({
      where: { id },
      data: { retiredAt: null },
    });
    await this.notifyDevicesChanged();
    return { message: 'Device restored' };
  }

  /** Deletes a device, or retires it when attempts or staff records point to it */
  async deleteDevice(id: string) {
    const [attempts, staffActivities, editLogs] = await Promise.all([
      this.prisma.attempt.count({ where: { deviceId: id } }),
      this.prisma.staffActivity.count({ where: { deviceId: id } }),
      this.prisma.attemptEditLog.count({ where: { deviceId: id } }),
    ]);
    const hasHistory = attempts + staffActivities + editLogs > 0;
    if (hasHistory) {
      await this.prisma.device.update({
        where: { id },
        data: { retiredAt: new Date() },
      });
    } else {
      await this.prisma.device.delete({
        where: { id },
      });
    }
    await this.notifyDevicesChanged();
    return {
      message: hasHistory ? 'Device retired' : 'Device deleted',
    };
  }

  private async notifyDevicesChanged() {
    this.stationsByEspId.clear();
    this.appGateway.handleDeviceUpdated();
    await this.socketController.sendServerStatus();
  }

  async uploadFirmware(data: UploadFirmwareDto) {
    this.socketController.sendFirmware(data.fileName, data.fileData);
  }
}
