import { forwardRef, Module } from '@nestjs/common';
import { SocketModule } from '../socket/socket.module';
import { WcaModule } from '../wca/wca.module';
import { CompetitionService } from './competition.service';
import { CompetitionController } from './competition.controller';
import { AuthModule } from 'src/auth/auth.module';
import { ResultModule } from 'src/result/result.module';
import { AppModule } from 'src/app.module';

@Module({
  providers: [CompetitionService],
  controllers: [CompetitionController],
  imports: [
    AuthModule,
    WcaModule,
    forwardRef(() => SocketModule),
    ResultModule,
    forwardRef(() => AppModule),
  ],
  exports: [CompetitionService],
})
export class CompetitionModule {}
