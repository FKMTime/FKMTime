import {
  Body,
  Controller,
  Delete,
  forwardRef,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GetUser } from 'src/auth/decorator/getUser.decorator';
import { JwtAuthDto } from 'src/auth/dto/jwt-auth.dto';
import { OrganizerGuard } from 'src/auth/guards/organizer.guard';
import { PersonService } from 'src/person/person.service';

import { AddCompetitorToRoundDto } from './dto/addCompetitorToRound.dto';
import {
  PlaceInGroupDto,
  RemoveNoShowsDto,
  WithdrawDto,
} from './dto/roundActions.dto';
import { IntegratedLiveRoundsService } from './integratedLiveRounds.service';

/** Running rounds in WCA Integrated Live Results (SPEC-006 section 4) */
@Controller('competition/integrated-live/rounds')
@UseGuards(OrganizerGuard)
export class IntegratedLiveController {
  constructor(
    private readonly rounds: IntegratedLiveRoundsService,
    @Inject(forwardRef(() => PersonService))
    private readonly personService: PersonService,
  ) {}

  @Get()
  async getRounds() {
    return await this.rounds.getRoundSummaries();
  }

  /** Results that aren't getting through, for Home's alert */
  @Get('problems')
  async getProblems() {
    return await this.rounds.getProblems();
  }

  /** The WCA's rules behind "not registered" results (WCRP 6.4, 5.2.1) */
  @Get('registration-rules')
  async getRegistrationRules() {
    return await this.rounds.getRegistrationRules();
  }

  @Get('no-shows')
  async getNoShows() {
    return await this.rounds.getNoShows();
  }

  @HttpCode(HttpStatus.OK)
  @Post(':roundId/no-shows')
  async removeNoShows(
    @Param('roundId') roundId: string,
    @Body() dto: RemoveNoShowsDto,
  ) {
    return await this.rounds.removeNoShows(roundId, dto.registrationIds);
  }

  @HttpCode(HttpStatus.OK)
  @Post(':roundId/clear')
  async clearRound(@Param('roundId') roundId: string) {
    return await this.rounds.clearRound(roundId);
  }

  @Get(':roundId/withdrawal/:personId')
  async previewWithdrawal(
    @Param('roundId') roundId: string,
    @Param('personId') personId: string,
  ) {
    return await this.rounds.previewWithdrawal(roundId, personId);
  }

  @HttpCode(HttpStatus.OK)
  @Post(':roundId/withdrawal/:personId')
  async withdraw(
    @Param('roundId') roundId: string,
    @Param('personId') personId: string,
    @Body() dto: WithdrawDto,
  ) {
    return await this.rounds.withdraw(roundId, personId, dto.advancingIds);
  }

  /** Puts a replacement, or someone added to the round, into a group */
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  @Post(':roundId/group-placement')
  async placeInGroup(
    @Body() dto: PlaceInGroupDto,
    @GetUser() user: JwtAuthDto,
  ) {
    return await this.personService.addCompetingGroup(
      user.userId,
      dto.personId,
      dto.groupId,
    );
  }

  /** The round's WCA state, sync status and the WCA's copy of each result */
  @Get(':roundId/details')
  async getRoundDetails(@Param('roundId') roundId: string) {
    return await this.rounds.getRoundDetails(roundId);
  }

  /** Empties one competitor's result in the WCA, then resends FKMTime's */
  @HttpCode(HttpStatus.OK)
  @Post(':roundId/results/:registrationId/clear')
  async clearResult(
    @Param('roundId') roundId: string,
    @Param('registrationId', ParseIntPipe) registrationId: number,
  ) {
    return await this.rounds.clearResult(roundId, registrationId);
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
