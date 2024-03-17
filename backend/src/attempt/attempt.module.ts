import { forwardRef, Module } from '@nestjs/common';
import { AttemptService } from './attempt.service';
import { AttemptController } from './attempt.controller';
import { ResultModule } from 'src/result/result.module';
import { AuthModule } from '../auth/auth.module';
import { IncidentsGateway } from './incidents.gateway';

@Module({
  providers: [AttemptService, IncidentsGateway],
  controllers: [AttemptController],
  imports: [AuthModule, forwardRef(() => ResultModule)],
  exports: [IncidentsGateway],
})
export class AttemptModule {}
