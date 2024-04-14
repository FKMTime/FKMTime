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
import { AdminGuard } from '../auth/guards/admin.guard';
import { TokenGuard } from '../auth/guards/token.guard';
import { DeviceService } from './device.service';
import { DeviceDto } from './dto/device.dto';
import { RequestToConnectDto } from './dto/requestToConnect.dto';
import { UpdateBatteryPercentageDto } from './dto/updateBatteryPercentage.dto';
import { DeviceType } from '@prisma/client';

@Controller('device')
export class DeviceController {
  constructor(private readonly deviceService: DeviceService) {}

  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Get()
  async getAllDevices(@Query('type') type: DeviceType) {
    return this.deviceService.getAllDevices(type);
  }

  @UseGuards(AdminGuard)
  @Post()
  async createDevice(@Body() data: DeviceDto) {
    return this.deviceService.createDevice(data);
  }

  @UseGuards(TokenGuard)
  @Post('battery')
  async updateBatteryPercentage(@Body() data: UpdateBatteryPercentageDto) {
    return this.deviceService.updateBatteryPercentage(data);
  }

  @UseGuards(AdminGuard)
  @Put(':id')
  async updateDevice(@Param('id') id: string, @Body() data: DeviceDto) {
    return this.deviceService.updateDevice(id, data);
  }

  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async deleteDevice(@Param('id') id: string) {
    return this.deviceService.deleteDevice(id);
  }

  @Post('connect')
  async requestToConnect(@Body() data: RequestToConnectDto) {
    return this.deviceService.requestToConnect(data);
  }
}
