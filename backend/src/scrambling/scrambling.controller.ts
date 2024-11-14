import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ScramblingDeviceGuard } from 'src/auth/guards/scramblingDevice.guard';
import { ScrambleSetService } from 'src/scramble-set/scramble-set.service';

import { UnlockScrambleSetDto } from './dto/unlockScrambleSet.dto';
import { ScramblingService } from './scrambling.service';

@UseGuards(ScramblingDeviceGuard)
@Controller('scrambling')
export class ScramblingController {
  constructor(
    private readonly scramblingService: ScramblingService,
    private readonly scrambleSetService: ScrambleSetService,
  ) {}

  @Get('sets/round/:roundId')
  async getScrambleSets(@Param('roundId') roundId: string) {
    return this.scrambleSetService.getScrambleSets(roundId);
  }

  @Get('sets/:id')
  async getScrambleSetById(@Param('id') id: string) {
    return this.scrambleSetService.getScrambleSetById(id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('sets/:id/unlock')
  async unlockScrambleSet(
    @Param('id') id: string,
    @Body() data: UnlockScrambleSetDto,
  ) {
    return this.scramblingService.unlockScrambleSet(id, data);
  }
}
