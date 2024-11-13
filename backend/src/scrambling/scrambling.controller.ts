import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ScramblingDeviceGuard } from 'src/auth/guards/scramblingDevice.guard';
import { ScrambleSetService } from 'src/scramble-set/scramble-set.service';

@UseGuards(ScramblingDeviceGuard)
@Controller('scrambling')
export class ScramblingController {
  constructor(private readonly scrambleSetService: ScrambleSetService) {}

  @Get('sets/:roundId')
  async getScrambleSets(@Param('roundId') roundId: string) {
    return this.scrambleSetService.getScrambleSets(roundId);
  }
}
