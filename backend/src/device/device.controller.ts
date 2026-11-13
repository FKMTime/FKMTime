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
import { AuthGuard } from '@nestjs/passport';
import { DeviceType } from '@prisma/client';
import { GetUser } from 'src/auth/decorator/getUser.decorator';
import { JwtAuthDto } from 'src/auth/dto/jwt-auth.dto';
import { DelegateGuard } from 'src/auth/guards/delegate.guard';
import { OrganizerGuard } from 'src/auth/guards/organizer.guard';

import { AdminGuard } from '../auth/guards/admin.guard';
import { DeviceService } from './device.service';
import { DeviceDto } from './dto/device.dto';
import { SetCustomRoundDto } from './dto/setCustomRound.dto';
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
  @Get('retired')
  async getRetiredDevices() {
    return this.deviceService.getRetiredDevices();
  }

  @UseGuards(OrganizerGuard)
  @Post()
  async createDevice(@Body() data: DeviceDto) {
    return this.deviceService.createDevice(data);
  }

  // Before ':id', which would otherwise take "custom-round" as an id
  @UseGuards(AuthGuard('jwt'), DelegateGuard)
  @Put('custom-round')
  async setCustomRound(
    @Body() data: SetCustomRoundDto,
    @GetUser() user: JwtAuthDto,
  ) {
    return this.deviceService.setCustomRound(data, user.userId);
  }

  @UseGuards(OrganizerGuard)
  @Put(':id')
  async updateDevice(@Param('id') id: string, @Body() data: DeviceDto) {
    return this.deviceService.updateDevice(id, data);
  }

  @UseGuards(OrganizerGuard)
  @HttpCode(HttpStatus.OK)
  @Post(':id/reconnect')
  async reconnectDevice(@Param('id') id: string) {
    return this.deviceService.reconnectDevice(id);
  }

  @UseGuards(OrganizerGuard)
  @HttpCode(HttpStatus.OK)
  @Post(':id/restore')
  async restoreDevice(@Param('id') id: string) {
    return this.deviceService.restoreDevice(id);
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
