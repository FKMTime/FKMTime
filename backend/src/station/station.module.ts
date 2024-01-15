import { Module } from '@nestjs/common';
import { StationService } from './station.service';
import { StationController } from './station.controller';

@Module({
  providers: [StationService],
  controllers: [StationController]
})
export class StationModule {}
