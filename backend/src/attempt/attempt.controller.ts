import {
  Body,
  Controller,
  Delete,
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
