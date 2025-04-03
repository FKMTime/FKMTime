import { Module } from '@nestjs/common';

import { IncidentController } from './incident.controller';
import { IncidentService } from './incident.service';

@Module({
  providers: [IncidentService],
  controllers: [IncidentController],
  exports: [IncidentService],
})
export class IncidentModule {}
