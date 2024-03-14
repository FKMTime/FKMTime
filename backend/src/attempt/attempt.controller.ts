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
import { AttemptService } from './attempt.service';
import { UpdateAttemptDto } from './dto/updateAttempt.dto';
import { CreateAttemptDto } from './dto/createAttempt.dto';
import { AdminOrDelegateGuard } from '../auth/guards/adminOrDelegate.guard';
import { AuthGuard } from '@nestjs/passport';
import { SwapAttemptsDto } from './dto/swapAttempts.dto';

@UseGuards(AuthGuard('jwt'), AdminOrDelegateGuard)
@Controller('attempt')
export class AttemptController {
  constructor(private readonly attemptService: AttemptService) {}

  @Get('unresolved')
  async getUnresolvedAttempts() {
    return this.attemptService.getUnresolvedAttempts();
  }

  @Post('')
  async createAttempt(@Body() data: CreateAttemptDto) {
    return await this.attemptService.createAttempt(data);
  }

  @Put('swap')
  async swapAttempts(@Body() data: SwapAttemptsDto) {
    return await this.attemptService.swapAttempts(
      data.firstAttemptId,
      data.secondAttemptId,
    );
  }

  @Get(':id')
  async getAttemptById(@Param('id') id: string) {
    return await this.attemptService.getAttemptById(id);
  }

  @Put(':id')
  async updateAttempt(@Param('id') id: string, @Body() data: UpdateAttemptDto) {
    return await this.attemptService.updateAttempt(id, data);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async deleteAttempt(@Param('id') id: string) {
    return await this.attemptService.deleteAttempt(id);
  }
}
