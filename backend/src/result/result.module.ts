import { forwardRef, Module } from '@nestjs/common';
import { ResultService } from './result.service';
import { ResultController } from './result.controller';
import { AuthModule } from '../auth/auth.module';
import { AttemptModule } from '../attempt/attempt.module';

@Module({
  providers: [ResultService],
  controllers: [ResultController],
  exports: [ResultService],
  imports: [AuthModule, forwardRef(() => AttemptModule)],
})
export class ResultModule {}
