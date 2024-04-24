import { forwardRef, Module } from '@nestjs/common';
import { SocketModule } from '../socket/socket.module';
import { WcaModule } from '../wca/wca.module';
import { CompetitionService } from './competition.service';
import { CompetitionController } from './competition.controller';
import { AuthModule } from 'src/auth/auth.module';
import { CompetitionGateway } from './competition.gateway';

@Module({
  providers: [CompetitionService, CompetitionGateway],
  controllers: [CompetitionController],
  imports: [AuthModule, WcaModule, forwardRef(() => SocketModule)],
  exports: [CompetitionService],
})
export class CompetitionModule {}
