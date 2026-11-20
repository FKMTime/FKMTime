import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

import { SendPacketDto } from './dto/sendPacket.dto';
import { StationTesterService } from './station-tester.service';
import { StationTesterEnabledGuard } from './stationTesterEnabled.guard';

// Every packet is logged in full and holds a socket connection until its
// reply, so one client may send ten a second. A group fill sends one at a
// time and stays well under it. Any signed-in account may use it: it only
// exists in the dev stack and PR previews, where the data is invented
@UseGuards(StationTesterEnabledGuard, ThrottlerGuard, AuthGuard('jwt'))
@Throttle({ default: { ttl: 60000, limit: 600 } })
@Controller('station-tester')
export class StationTesterController {
  constructor(private readonly stationTesterService: StationTesterService) {}

  @HttpCode(200)
  @Post('send')
  async send(@Body() data: SendPacketDto) {
    return await this.stationTesterService.send(data);
  }
}
