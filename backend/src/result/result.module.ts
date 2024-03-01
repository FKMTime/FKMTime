import { Module } from '@nestjs/common';
import { ResultService } from './result.service';
import { ResultController } from './result.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  providers: [ResultService],
  controllers: [ResultController],
  exports: [ResultService],
  imports: [AuthModule],
})
export class ResultModule {}
