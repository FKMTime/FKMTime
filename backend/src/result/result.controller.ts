import {
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
import { AdminGuard } from '../auth/guards/admin.guard';
import { ResultService } from './result.service';

@Controller('result')
export class ResultController {
  constructor(private readonly resultService: ResultService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get('round/:roundId')
  async getAllResultsByRoundId(
    @Param('roundId') roundId: string,
    @Query('search') search: string,
  ) {
    return this.resultService.getAllResultsByRound(roundId, search);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('person/:id')
  async getAllResultsByPersonId(@Param('id') id: string) {
    return this.resultService.getAllResultsByPerson(id);
  }

  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Get(':id')
  async getResultById(@Param('id') id: string) {
    return await this.resultService.getResultById(id);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Delete(':id')
  async deleteResultById(@Param('id') id: string) {
    return await this.resultService.deleteResultById(id);
  }

  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Post('round/:roundId/enter')
  async enterRoundToWcaLive(@Param('roundId') roundId: string) {
    return await this.resultService.enterRoundToWcaLive(roundId);
  }

  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Get(':id/enter')
  async enterWholeScorecardToWcaLive(@Param('id') id: string) {
    return await this.resultService.enterWholeScorecardToWcaLive(id);
  }
}
