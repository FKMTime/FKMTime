import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DeviceType } from '@prisma/client';
import { OrganizerGuard } from 'src/auth/guards/organizer.guard';

import { AdminGuard } from '../auth/guards/admin.guard';
import { DeviceService } from './device.service';
import { DeviceDto } from './dto/device.dto';
import { UploadFirmwareDto } from './dto/uploadFirmware.dto';

@Controller('device')
export class DeviceController {
  constructor(private readonly deviceService: DeviceService) {}

  @UseGuards(OrganizerGuard)
  @Get()
  async getAllDevices(
    @Query('type') type: DeviceType,
    @Query('roomId') roomId: string,
  ) {
    return this.deviceService.getAllDevices(type, roomId);
  }

  @UseGuards(OrganizerGuard)
  @Post()
  async createDevice(@Body() data: DeviceDto) {
    return this.deviceService.createDevice(data);
  }

  @UseGuards(OrganizerGuard)
  @Put(':id')
  async updateDevice(@Param('id') id: string, @Body() data: DeviceDto) {
    return this.deviceService.updateDevice(id, data);
  }

  @UseGuards(OrganizerGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async deleteDevice(@Param('id') id: string) {
    return this.deviceService.deleteDevice(id);
  }

  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.OK)
  @Post('upload-firmware')
  async uploadFirmware(@Body() data: UploadFirmwareDto) {
    return this.deviceService.uploadFirmware(data);
  }
}
