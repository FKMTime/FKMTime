import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { GetScramblingDeviceToken } from 'src/auth/decorator/getScramblingDeviceToken.decorator';
import { ScramblingDeviceGuard } from 'src/auth/guards/scramblingDevice.guard';
import { ScrambleSetService } from 'src/scramble-set/scramble-set.service';

import { CreateScrambledAttemptDto } from './dto/createScrambledAttempt.dto';
import { UnlockScrambleSetDto } from './dto/unlockScrambleSet.dto';
import { ScramblingService } from './scrambling.service';

@UseGuards(ScramblingDeviceGuard)
@Controller('scrambling')
export class ScramblingController {
  constructor(
    private readonly scramblingService: ScramblingService,
    private readonly scrambleSetService: ScrambleSetService,
  ) {}

  @Get('room')
  async getRoom(@GetScramblingDeviceToken() token: string) {
    return this.scramblingService.getDeviceRoom(token);
  }

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

  @Get('scramble/:cardId')
  async getScrambleData(
    @GetScramblingDeviceToken() token: string,
    @Param('cardId') cardId: string,
    @Param('roundId') roundId: string,
  ) {
    return this.scramblingService.getScrambleData(token, cardId, roundId);
  }

  @Post('scramble')
  async createScrambledAttempt(
    @GetScramblingDeviceToken() token: string,
    @Body() data: CreateScrambledAttemptDto,
  ) {
    return this.scramblingService.createScrambledAttempt(token, data);
  }

  @Get('person/:cardId')
  async getPersonDataByCardId(
    @GetScramblingDeviceToken() token: string,
    @Param('cardId') cardId: string,
  ) {
    return this.scramblingService.getPersonDataByCardId(token, cardId);
  }
}
