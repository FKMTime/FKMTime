import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ServerLogController } from './serverLog.controller';
import { ServerLogGateway } from './serverLog.gateway';
import { ServerLogService } from './serverLog.service';

@Module({
  providers: [ServerLogService, ServerLogGateway],
  controllers: [ServerLogController],
  imports: [AuthModule],
})
export class ServerLogModule {}
