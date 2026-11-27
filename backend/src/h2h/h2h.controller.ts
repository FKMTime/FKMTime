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
import { AuthGuard } from '@nestjs/passport';
import { OrganizerGuard } from 'src/auth/guards/organizer.guard';
import { StageLeaderGuard } from 'src/auth/guards/stageLeader.guard';
import { ParseRoundIdPipe } from 'src/roundId.pipe';

import { CreateBracketDto } from './dto/createBracket.dto';
import { UpdateBracketDto } from './dto/updateBracket.dto';
import { UpdateScramblePlanDto } from './dto/updateScramblePlan.dto';
import { UpdateSeedsDto } from './dto/updateSeeds.dto';
import { H2hService } from './h2h.service';
import { H2hMatchService } from './h2hMatch.service';

/** Head-to-head brackets (SPEC-001) */
@UseGuards(AuthGuard('jwt'))
@Controller('h2h')
export class H2hController {
  constructor(
    private readonly h2hService: H2hService,
    private readonly h2hMatchService: H2hMatchService,
  ) {}

  /** Starts a ready match; its competitors' attempts then go into it */
  @UseGuards(StageLeaderGuard)
  @HttpCode(HttpStatus.OK)
  @Post('match/:id/start')
  async startMatch(@Param('id') id: string) {
    const { roundId } = await this.h2hMatchService.startMatch(id);
    return this.h2hService.getBracketView(roundId);
  }

  @Get(':roundId')
  async getBracket(@Param('roundId', ParseRoundIdPipe) roundId: string) {
    return this.h2hService.getBracketView(roundId);
  }

  @UseGuards(OrganizerGuard)
  @Post(':roundId')
  async createBracket(
    @Param('roundId', ParseRoundIdPipe) roundId: string,
    @Body() dto: CreateBracketDto,
  ) {
    return this.h2hService.createBracket(roundId, dto);
  }

  @UseGuards(OrganizerGuard)
  @Put(':roundId/seeds')
  async updateSeeds(
    @Param('roundId', ParseRoundIdPipe) roundId: string,
    @Body() dto: UpdateSeedsDto,
  ) {
    return this.h2hService.updateSeeds(roundId, dto);
  }

  @UseGuards(OrganizerGuard)
  @Put(':roundId/scrambles')
  async updateScramblePlan(
    @Param('roundId', ParseRoundIdPipe) roundId: string,
    @Body() dto: UpdateScramblePlanDto,
  ) {
    return this.h2hService.updateScramblePlan(roundId, dto);
  }

  @UseGuards(OrganizerGuard)
  @Put(':roundId')
  async updateBracket(
    @Param('roundId', ParseRoundIdPipe) roundId: string,
    @Body() dto: UpdateBracketDto,
  ) {
    return this.h2hService.updateBracket(roundId, dto);
  }

  @UseGuards(OrganizerGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':roundId')
  async deleteBracket(@Param('roundId', ParseRoundIdPipe) roundId: string) {
    await this.h2hService.deleteBracket(roundId);
  }
}
