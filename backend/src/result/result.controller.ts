import { Body, Controller, Post } from '@nestjs/common';
import { EnterAttemptDto } from './dto/enterAttempt.dto';
import { ResultService } from './result.service';

@Controller('result')
export class ResultController {
  constructor(private readonly resultService: ResultService) {}

  @Post('enter')
  async enterAttempt(@Body() data: EnterAttemptDto) {
    return this.resultService.enterAttempt(data);
  }
}
