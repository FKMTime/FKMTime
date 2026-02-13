import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GetUser } from 'src/auth/decorator/getUser.decorator';
import { JwtAuthDto } from 'src/auth/dto/jwt-auth.dto';
import { DelegateGuard } from 'src/auth/guards/delegate.guard';

import { AttemptService } from './attempt.service';
import { CreateAttemptDto } from './dto/createAttempt.dto';
import { EnterScorecardDto } from './dto/enterScorecard.dto';
import { SwapAttemptsDto } from './dto/swapAttempts.dto';
import { UpdateAttemptDto } from './dto/updateAttempt.dto';

@UseGuards(AuthGuard('jwt'), DelegateGuard)
@Controller('attempt')
export class AttemptController {
  constructor(private readonly attemptService: AttemptService) {}

  @Post()
  async createAttempt(
    @Body() data: CreateAttemptDto,
    @GetUser() user: JwtAuthDto,
  ) {
    return await this.attemptService.createAttempt(data, user.userId);
  }

  @Put('swap')
  async swapAttempts(@Body() data: SwapAttemptsDto) {
    return await this.attemptService.swapAttempts(
      data.firstAttemptId,
      data.secondAttemptId,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('scorecard')
  async enterScorecard(
    @Body() data: EnterScorecardDto,
    @GetUser() user: JwtAuthDto,
  ) {
    return await this.attemptService.enterScorecard(data, user.userId);
  }

  @Get(':id')
  async getAttemptById(@Param('id') id: string) {
    return await this.attemptService.getAttemptById(id);
  }

  @Put(':id')
  async updateAttempt(
    @Param('id') id: string,
    @Body() data: UpdateAttemptDto,
    @GetUser() user: JwtAuthDto,
  ) {
    return await this.attemptService.updateAttempt(id, data, user.userId);
  }

  @Delete(':id')
  async deleteAttempt(@Param('id') id: string) {
    return await this.attemptService.deleteAttempt(id);
  }
}
