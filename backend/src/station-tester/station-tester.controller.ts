import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { DevOnlyGuard } from './devOnly.guard';
import { SendPacketDto } from './dto/sendPacket.dto';
import { StationTesterService } from './station-tester.service';

@UseGuards(DevOnlyGuard, AuthGuard('jwt'))
@Controller('station-tester')
export class StationTesterController {
  constructor(private readonly stationTesterService: StationTesterService) {}

  @HttpCode(200)
  @Post('send')
  async send(@Body() data: SendPacketDto) {
    return await this.stationTesterService.send(data);
  }
}
