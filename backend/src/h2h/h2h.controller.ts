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
import { GetUser } from 'src/auth/decorator/getUser.decorator';
import { JwtAuthDto } from 'src/auth/dto/jwt-auth.dto';
import { DelegateGuard } from 'src/auth/guards/delegate.guard';
import { OrganizerGuard } from 'src/auth/guards/organizer.guard';
import { StageLeaderGuard } from 'src/auth/guards/stageLeader.guard';
import { ParseRoundIdPipe } from 'src/roundId.pipe';

import { CreateBracketDto } from './dto/createBracket.dto';
import { ExportCsvDto } from './dto/exportCsv.dto';
import { GrantExtraDto } from './dto/grantExtra.dto';
import { ReopenMatchDto } from './dto/reopenMatch.dto';
import { RetireDto } from './dto/retire.dto';
import { UpdateBracketDto } from './dto/updateBracket.dto';
import { UpdateScramblePlanDto } from './dto/updateScramblePlan.dto';
import { UpdateSeedsDto } from './dto/updateSeeds.dto';
import { WithdrawDto } from './dto/withdraw.dto';
import { H2hService } from './h2h.service';
import { H2hExportService } from './h2hExport.service';
import { H2hMatchService } from './h2hMatch.service';
import { H2hMatchActionsService } from './h2hMatchActions.service';

/** Head-to-head brackets (SPEC-001) */
@UseGuards(AuthGuard('jwt'))
@Controller('h2h')
export class H2hController {
  constructor(
    private readonly h2hService: H2hService,
    private readonly h2hMatchService: H2hMatchService,
    private readonly h2hMatchActions: H2hMatchActionsService,
    private readonly h2hExport: H2hExportService,
  ) {}

  /** Starts a ready match; its competitors' attempts then go into it */
  @UseGuards(StageLeaderGuard)
  @HttpCode(HttpStatus.OK)
  @Post('match/:id/start')
  async startMatch(@Param('id') id: string) {
    const { roundId } = await this.h2hMatchService.startMatch(id);
    return this.h2hService.getBracketView(roundId);
  }

  /** Extra granted on a point: both competitors race it again (11k1) */
  @UseGuards(DelegateGuard)
  @HttpCode(HttpStatus.OK)
  @Post('point/:id/extra')
  async grantExtra(
    @Param('id') id: string,
    @Body() dto: GrantExtraDto,
    @GetUser() user: JwtAuthDto,
  ) {
    const { roundId } = await this.h2hMatchActions.grantExtra(
      id,
      user.userId,
      dto.comment,
    );
    return this.h2hService.getBracketView(roundId);
  }

  /** A competitor withdraws before their match: a walkover (I2h) */
  @UseGuards(DelegateGuard)
  @HttpCode(HttpStatus.OK)
  @Post('match/:id/withdraw')
  async withdraw(
    @Param('id') id: string,
    @Body() dto: WithdrawDto,
    @GetUser() user: JwtAuthDto,
  ) {
    const { roundId } = await this.h2hMatchActions.withdraw(
      id,
      dto.side,
      user.userId,
      dto.comment,
    );
    return this.h2hService.getBracketView(roundId);
  }

  /** A competitor can't go on during their match: the opponent wins it */
  @UseGuards(DelegateGuard)
  @HttpCode(HttpStatus.OK)
  @Post('match/:id/retire')
  async retire(
    @Param('id') id: string,
    @Body() dto: RetireDto,
    @GetUser() user: JwtAuthDto,
  ) {
    const { roundId } = await this.h2hMatchActions.retire(
      id,
      dto.side,
      user.userId,
      dto.comment,
    );
    return this.h2hService.getBracketView(roundId);
  }

  /** Decides a finished match again from its times as they are now */
  @UseGuards(DelegateGuard)
  @HttpCode(HttpStatus.OK)
  @Post('match/:id/reopen')
  async reopen(
    @Param('id') id: string,
    @Body() dto: ReopenMatchDto,
    @GetUser() user: JwtAuthDto,
  ) {
    const { roundId } = await this.h2hMatchActions.reopen(
      id,
      user.userId,
      dto.comment,
    );
    return this.h2hService.getBracketView(roundId);
  }

  /** What still blocks the WCA CSV, listed before the password is asked */
  @UseGuards(OrganizerGuard)
  @Get(':roundId/export/checks')
  async getExportChecks(@Param('roundId', ParseRoundIdPipe) roundId: string) {
    return this.h2hExport.getChecks(roundId);
  }

  /**
   * The WCA CSV of the round. The password decrypts the scrambles for this
   * request only: it is never stored or logged.
   */
  @UseGuards(OrganizerGuard)
  @HttpCode(HttpStatus.OK)
  @Post(':roundId/export')
  async exportCsv(
    @Param('roundId', ParseRoundIdPipe) roundId: string,
    @Body() dto: ExportCsvDto,
  ) {
    return this.h2hExport.exportCsv(roundId, dto.password);
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
