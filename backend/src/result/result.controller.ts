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
  @Get(':id')
  async getResultById(@Param('id') id: number) {
    return await this.resultService.getResultById(id);
  }

  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  @Post('round/:roundId/enter')
  async enterAllAttemptsByRoundId(@Param('roundId') roundId: string) {
    return await this.resultService.enterRoundToWcaLive(roundId);
  }

  @Post('enter')
  async enterAttempt(@Body() data: EnterAttemptDto) {
    return await this.resultService.enterAttempt(data);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get(':id/enter')
  async enterWholeScorecardToWcaLive(@Param('id') id: number) {
    return await this.resultService.enterWholeScorecardToWcaLive(id);
  }
}
