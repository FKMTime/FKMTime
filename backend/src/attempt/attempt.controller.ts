import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { GetUser } from 'src/auth/decorator/getUser.decorator';
import { JwtAuthDto } from 'src/auth/dto/jwt-auth.dto';
import { DelegateGuard } from 'src/auth/guards/delegate.guard';
import { OrganizerGuard } from 'src/auth/guards/organizer.guard';

import { AttemptService } from './attempt.service';
import { CreateAttemptDto } from './dto/createAttempt.dto';
import { SwapAttemptsDto } from './dto/swapAttempts.dto';
import { UpdateAttemptDto } from './dto/updateAttempt.dto';

@Controller('attempt')
export class AttemptController {
  constructor(private readonly attemptService: AttemptService) {}

  @UseGuards(DelegateGuard)
  @Get('unresolved')
  async getUnresolvedAttempts() {
    return this.attemptService.getUnresolvedAttempts();
  }

  @UseGuards(DelegateGuard)
  @Get('unresolved/count')
  async getUnresolvedIncidentsCount() {
    return this.attemptService.getUnresolvedIncidentsCount();
  }

  @UseGuards(DelegateGuard)
  @Get('incidents')
  async getResolvedAttempts(@Query('search') search: string) {
    return this.attemptService.getIncidents(search);
  }

  @UseGuards(OrganizerGuard)
  @Post()
  async createAttempt(@Body() data: CreateAttemptDto) {
    return await this.attemptService.createAttempt(data);
  }

  @UseGuards(DelegateGuard)
  @Put('swap')
  async swapAttempts(@Body() data: SwapAttemptsDto) {
    return await this.attemptService.swapAttempts(
      data.firstAttemptId,
      data.secondAttemptId,
    );
  }

  @UseGuards(DelegateGuard)
  @Get(':id')
  async getAttemptById(@Param('id') id: string) {
    return await this.attemptService.getAttemptById(id);
  }

  @UseGuards(OrganizerGuard)
  @Put(':id')
  async updateAttempt(
    @Param('id') id: string,
    @Body() data: UpdateAttemptDto,
    @GetUser() user: JwtAuthDto,
  ) {
    return await this.attemptService.updateAttempt(id, data, user.userId);
  }

  @UseGuards(DelegateGuard)
  @Delete(':id')
  async deleteAttempt(@Param('id') id: string) {
    return await this.attemptService.deleteAttempt(id);
  }
}
