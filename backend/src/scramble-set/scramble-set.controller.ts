import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AdminGuard } from 'src/auth/guards/admin.guard';

import { ImportScramblesDto } from './dto/import-scrambles.dto';
import { ScrambleSetService } from './scramble-set.service';

@UseGuards(AdminGuard)
@Controller('scramble-set')
export class ScrambleSetController {
  constructor(private readonly scrambleSetService: ScrambleSetService) {}

  @Post('import')
  async importScrambles(@Body() data: ImportScramblesDto) {
    return this.scrambleSetService.importScrambles(data);
  }
}
