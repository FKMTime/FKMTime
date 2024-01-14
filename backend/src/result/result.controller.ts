import {
  Body,
  Controller,
  Param,
  Post,
  Get,
  UseGuards,
  Query,
} from '@nestjs/common';
import { EnterAttemptDto } from './dto/enterAttempt.dto';
import { ResultService } from './result.service';
import { AdminOrDelegateGuard } from 'src/auth/guards/adminOrDelegate.guard';

@Controller('result')
export class ResultController {
  constructor(private readonly resultService: ResultService) {}

  @UseGuards(AdminOrDelegateGuard)
  @Get('round/:roundId')
  async getAllResultsByRoundId(
    @Param('roundId') roundId: string,
    @Query('search') search: string,
  ) {
    return this.resultService.getAllResultsByRound(roundId, search);
  }

  @UseGuards(AdminOrDelegateGuard)
  @Get(':id')
  async getResultById(@Param('id') id: number) {
    return this.resultService.getResultById(id);
  }

  @Post('enter')
  async enterAttempt(@Body() data: EnterAttemptDto) {
    return this.resultService.enterAttempt(data);
  }
}
