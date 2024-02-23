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
import { AuthGuard } from '@nestjs/passport';
import { CreateAttemptDto } from './dto/createAttempt.dto';

@UseGuards(AuthGuard('jwt'))
@Controller('attempt')
export class AttemptController {
  constructor(private readonly attemptService: AttemptService) {}

  @Get('unresolved')
  async getUnresolvedAttempts() {
    return await this.attemptService.getUnresolvedAttempts();
  }

  @Post(':resultId')
  async createAttempt(
    @Param('resultId') resultId: number,
    @Body() data: CreateAttemptDto,
  ) {
    return await this.attemptService.createAttempt(resultId, data);
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
