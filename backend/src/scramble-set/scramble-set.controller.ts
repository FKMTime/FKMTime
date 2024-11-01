import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from 'src/auth/guards/admin.guard';

import { ImportScramblesDto } from './dto/import-scrambles.dto';
import { ScrambleSetService } from './scramble-set.service';

@UseGuards(AdminGuard)
@Controller('scramble-set')
export class ScrambleSetController {
  constructor(private readonly scrambleSetService: ScrambleSetService) {}

  @Get(':roundId')
  async getScrambleSets(@Param('roundId') roundId: string) {
    return this.scrambleSetService.getScrambleSets(roundId);
  }

  @Post('import')
  async importScrambles(@Body() data: ImportScramblesDto) {
    return this.scrambleSetService.importScrambles(data);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('all')
  async deleteAllScrambleSets() {
    return this.scrambleSetService.deleteAllScrambleSets();
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('round/:roundId')
  async deleteScrambleSetsByRoundId(@Param('roundId') roundId: string) {
    return this.scrambleSetService.deleteScrambleSetsByRoundId(roundId);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async deleteScrambleSet(@Param('id') id: string) {
    return this.scrambleSetService.deleteScrambleSet(id);
  }
}
