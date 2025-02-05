import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PersonController } from './person.controller';
import { PersonService } from './person.service';
import { PersonForDeviceService } from './personForDevice.service';

@Module({
  providers: [PersonService, PersonForDeviceService],
  controllers: [PersonController],
  exports: [PersonService, PersonForDeviceService],
  imports: [AuthModule],
})
export class PersonModule {}
