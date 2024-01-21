import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AdminOrDelegateGuard } from 'src/auth/guards/adminOrDelegate.guard';
import { AttemptService } from './attempt.service';
import { UpdateAttemptDto } from './dto/updateAttempt.dto';

@UseGuards(AdminOrDelegateGuard)
@Controller('attempt')
export class AttemptController {
  constructor(private readonly attemptService: AttemptService) {}

  @Get('unresolved')
  async getUnresolvedAttempts() {
    return await this.attemptService.getUnresolvedAttempts();
  }

  @Get(':id')
  async getAttemptById(@Param('id') id: number) {
    return await this.attemptService.getAttemptById(id);
  }

  @Put(':id')
  async updateAttempt(@Param('id') id: number, @Body() data: UpdateAttemptDto) {
    return await this.attemptService.updateAttempt(id, data);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async deleteAttempt(@Param('id') id: number) {
    return await this.attemptService.deleteAttempt(id);
  }
}
