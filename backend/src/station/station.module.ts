import { Module } from '@nestjs/common';
import { StationService } from './station.service';
import { StationController } from './station.controller';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  providers: [StationService],
  controllers: [StationController],
  imports: [AuthModule],
})
export class StationModule {}
