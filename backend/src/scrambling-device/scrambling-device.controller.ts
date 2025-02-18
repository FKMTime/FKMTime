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
  UseGuards,
} from '@nestjs/common';
import { DelegateGuard } from 'src/auth/guards/delegate.guard';

import { CheckTokenDto } from './dto/checkToken.dto';
import { GetTokenDto } from './dto/getToken.dto';
import { ScramblingDeviceDto } from './dto/scramblingDevice.dto';
import { ScramblingDeviceService } from './scrambling-device.service';

@Controller('scrambling-device')
export class ScramblingDeviceController {
  constructor(
    private readonly scramblingDeviceService: ScramblingDeviceService,
  ) {}

  @UseGuards(DelegateGuard)
  @Get()
  async getScramblingDevicesByRoom() {
    return this.scramblingDeviceService.getScramblingDevicesByRoom();
  }

  @UseGuards(DelegateGuard)
  @Post()
  async createScramblingDevice(@Body() data: ScramblingDeviceDto) {
    return this.scramblingDeviceService.createScramblingDevice(data);
  }

  @UseGuards(DelegateGuard)
  @Get(':id/code')
  async generateOneTimeCode(@Param('id') scramblingDeviceId: string) {
    return this.scramblingDeviceService.generateOneTimeCode(scramblingDeviceId);
  }

  @Post('token')
  async getToken(@Body() data: GetTokenDto) {
    return this.scramblingDeviceService.getToken(data);
  }

  @HttpCode(HttpStatus.OK)
  @Post('token-valid')
  async isTokenValid(@Body() data: CheckTokenDto) {
    return this.scramblingDeviceService.isTokenValid(data);
  }

  @UseGuards(DelegateGuard)
  @Put(':id')
  async updateScramblingDevice(
    @Param('id') id: string,
    @Body() data: ScramblingDeviceDto,
  ) {
    return this.scramblingDeviceService.updateScramblingDevice(id, data);
  }

  @UseGuards(DelegateGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async deleteScramblingDevice(@Param('id') id: string) {
    return this.scramblingDeviceService.deleteScramblingDevice(id);
  }
}
