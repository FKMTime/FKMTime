import { forwardRef, Module } from '@nestjs/common';
import { DeviceModule } from 'src/device/device.module';

import { IncidentController } from './incident.controller';
import { IncidentService } from './incident.service';

@Module({
  providers: [IncidentService],
  controllers: [IncidentController],
  exports: [IncidentService],
  imports: [forwardRef(() => DeviceModule)],
})
export class IncidentModule {}
