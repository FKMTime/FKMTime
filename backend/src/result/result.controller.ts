import {
  Body,
  Controller,
  Param,
  Post,
  Get,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { EnterAttemptDto } from './dto/enterAttempt.dto';
import { ResultService } from './result.service';
import { AuthGuard } from '@nestjs/passport';
import { AdminOrDelegateGuard } from '../auth/guards/adminOrDelegate.guard';

@Controller('result')
export class ResultController {
  constructor(private readonly resultService: ResultService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get('round/:roundId')
  async getAllResultsByRoundId(
    @Param('roundId') roundId: string,
    @Query('search') search: string,
  ) {
    return await this.resultService.getAllResultsByRound(roundId, search);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('person/:id')
  async getAllResultsByPersonId(@Param('id') id: string) {
    return await this.resultService.getAllResultsByPerson(id);
  }

  @UseGuards(AuthGuard('jwt'), AdminOrDelegateGuard)
  @Get(':id')
  async getResultById(@Param('id') id: string) {
    return await this.resultService.getResultById(id);
  }

  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'), AdminOrDelegateGuard)
  @Post('round/:roundId/enter')
  async enterRoundToWcaLive(@Param('roundId') roundId: string) {
    return await this.resultService.enterRoundToWcaLive(roundId);
  }

  @Post('enter')
  async enterAttempt(@Body() data: EnterAttemptDto) {
    return await this.resultService.enterAttempt(data);
  }

  @UseGuards(AuthGuard('jwt'), AdminOrDelegateGuard)
  @Get(':id/enter')
  async enterWholeScorecardToWcaLive(@Param('id') id: string) {
    return await this.resultService.enterWholeScorecardToWcaLive(id);
  }
}
