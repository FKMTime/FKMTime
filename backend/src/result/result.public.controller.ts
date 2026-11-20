import { Controller, Get, Param, Query } from '@nestjs/common';
import { ParseRoundIdPipe } from 'src/roundId.pipe';

import { ResultService } from './result.service';

@Controller('result/public')
export class PublicResultController {
  constructor(private readonly resultService: ResultService) {}

  @Get('round/:roundId')
  async getAllResultsByRoundId(
    @Param('roundId', ParseRoundIdPipe) roundId: string,
    @Query('search') search: string,
  ) {
    return this.resultService.getAllResultsByRound(roundId, search);
  }
}
