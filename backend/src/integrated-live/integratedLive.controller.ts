import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { OrganizerGuard } from 'src/auth/guards/organizer.guard';

import { AddCompetitorToRoundDto } from './dto/addCompetitorToRound.dto';
import { IntegratedLiveRoundsService } from './integratedLiveRounds.service';

/** Running rounds in WCA Integrated Live Results (SPEC-006 section 4) */
@Controller('competition/integrated-live/rounds')
@UseGuards(OrganizerGuard)
export class IntegratedLiveController {
  constructor(private readonly rounds: IntegratedLiveRoundsService) {}

  @Get()
  async getRounds() {
    return await this.rounds.getRounds();
  }

  @Get(':roundId/blockers')
  async getOpeningBlockers(@Param('roundId') roundId: string) {
    return await this.rounds.getOpeningBlockers(roundId);
  }

  @HttpCode(HttpStatus.OK)
  @Post(':roundId/open')
  async openRound(@Param('roundId') roundId: string) {
    return await this.rounds.openRound(roundId);
  }

  @Delete(':roundId/close')
  async closeRound(@Param('roundId') roundId: string) {
    return await this.rounds.closeRound(roundId);
  }

  @Get(':roundId/addable')
  async getAddableCompetitors(@Param('roundId') roundId: string) {
    return await this.rounds.getAddableCompetitors(roundId);
  }

  @HttpCode(HttpStatus.OK)
  @Post(':roundId/competitors')
  async addCompetitor(
    @Param('roundId') roundId: string,
    @Body() dto: AddCompetitorToRoundDto,
  ) {
    return await this.rounds.addCompetitor(roundId, dto.registrationId);
  }
}
