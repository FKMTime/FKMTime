import {Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, UseGuards} from '@nestjs/common';
import { AdminGuard } from '../auth/guards/admin.guard';
import { DeviceService } from './device.service';
import {DeviceDto} from "./dto/device.dto";

@UseGuards(AdminGuard)
@Controller('device')
export class DeviceController {
  constructor(private readonly deviceService: DeviceService) {}

  @Get('')
  async getAllDevices() {
    return this.deviceService.getAllDevices();
  }

  @Post('')
  async createDevice(@Body() data: DeviceDto) {
    return this.deviceService.createDevice(data);
  }

  @Put(':id')
  async updateDevice(@Param('id') id: string, @Body() data: DeviceDto) {
    return this.deviceService.updateDevice(id, data);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async deleteDevice(@Param('id') id: string) {
    return this.deviceService.deleteDevice(id);
  }
}
