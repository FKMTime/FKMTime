import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DelegateGuard } from 'src/auth/guards/delegate.guard';
import { OrganizerGuard } from 'src/auth/guards/organizer.guard';

import { DoubleCheckDto } from './dto/doubleCheck.dto';
import { ResultService } from './result.service';

@UseGuards(AuthGuard('jwt'))
@Controller('result')
export class ResultController {
  constructor(private readonly resultService: ResultService) {}

  @Get('round/:roundId')
  async getAllResultsByRoundId(
    @Param('roundId') roundId: string,
    @Query('search') search: string,
  ) {
    return this.resultService.getAllResultsByRound(roundId, search);
  }

  @UseGuards(DelegateGuard)
  @Get('round/:roundId/double-check')
  async getResultsToDoubleCheckByRoundId(@Param('roundId') roundId: string) {
    return this.resultService.getResultsToDoubleCheckByRoundId(roundId);
  }

  @HttpCode(HttpStatus.OK)
  @UseGuards(DelegateGuard)
  @Post('double-check')
  async doubleCheckResultsByRoundId(@Body() data: DoubleCheckDto) {
    return this.resultService.doubleCheckResult(data);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(DelegateGuard)
  @Delete('round/:roundId/double-check')
  async undoDoubleCheckResultsByRoundId(@Param('roundId') roundId: string) {
    return this.resultService.undoDoubleCheckResultsByRoundId(roundId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('person/:id')
  async getAllResultsByPersonId(@Param('id') id: string) {
    return this.resultService.getAllResultsByPerson(id);
  }

  @UseGuards(DelegateGuard)
  @Get('checks')
  async getResultsChecks(@Query('roundId') roundId: string) {
    return await this.resultService.getResultsChecks(roundId);
  }

  @UseGuards(OrganizerGuard)
  @Get(':id')
  async getResultById(@Param('id') id: string) {
    return await this.resultService.getResultById(id);
  }

  @HttpCode(HttpStatus.OK)
  @UseGuards(OrganizerGuard)
  @Post(':id/assign-dns')
  async assignDnsOnRemainingAttempts(@Param('id') id: string) {
    return await this.resultService.assignDnsOnRemainingAttempts(id);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(DelegateGuard)
  @Delete(':id')
  async deleteResultById(@Param('id') id: string) {
    return await this.resultService.deleteResultById(id);
  }

  @HttpCode(HttpStatus.OK)
  @UseGuards(OrganizerGuard)
  @Post('round/:roundId/enter')
  async enterRoundToWcaLiveOrCubingContests(@Param('roundId') roundId: string) {
    return await this.resultService.enterRoundToWcaLiveOrCubingContests(
      roundId,
    );
  }

  @HttpCode(HttpStatus.OK)
  @UseGuards(OrganizerGuard)
  @Get(':id/enter')
  async enterWholeScorecardToWcaLiveOrCubingContests(@Param('id') id: string) {
    return await this.resultService.enterWholeScorecardToWcaLiveOrCubingContests(
      id,
    );
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(DelegateGuard)
  @Delete('group/:id/restart')
  async restartGroup(@Param('id') id: string) {
    return await this.resultService.restartGroup(id);
  }
}
