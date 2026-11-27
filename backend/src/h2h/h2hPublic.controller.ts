import { Controller, Get, Param } from '@nestjs/common';
import { ParseRoundIdPipe } from 'src/roundId.pipe';

import { H2hPublicService } from './h2hPublic.service';

/** Head-to-head brackets for spectators, without signing in (SPEC-001) */
@Controller('h2h/public')
export class H2hPublicController {
  constructor(private readonly h2hPublic: H2hPublicService) {}

  @Get(':roundId')
  async getPublicBracket(@Param('roundId', ParseRoundIdPipe) roundId: string) {
    return this.h2hPublic.getPublicView(roundId);
  }
}
