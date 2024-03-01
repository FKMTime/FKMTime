import { Module } from '@nestjs/common';
import { AttemptService } from './attempt.service';
import { AttemptController } from './attempt.controller';
import { ResultModule } from 'src/result/result.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  providers: [AttemptService],
  controllers: [AttemptController],
  imports: [ResultModule, AuthModule],
})
export class AttemptModule {}
