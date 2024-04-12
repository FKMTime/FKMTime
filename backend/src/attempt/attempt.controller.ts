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
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AttemptService } from './attempt.service';
import { CreateAttemptDto } from './dto/createAttempt.dto';
import { SwapAttemptsDto } from './dto/swapAttempts.dto';
import { UpdateAttemptDto } from './dto/updateAttempt.dto';

@UseGuards(AuthGuard('jwt'), AdminGuard)
@Controller('attempt')
export class AttemptController {
  constructor(private readonly attemptService: AttemptService) {}

  @Get('unresolved')
  async getUnresolvedAttempts() {
    return this.attemptService.getUnresolvedAttempts();
  }

  @Get('incidents')
  async getResolvedAttempts(@Query('search') search: string) {
    return this.attemptService.getIncidents(search);
  }

  @Post()
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
