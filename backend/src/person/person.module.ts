import { Module } from '@nestjs/common';
import { WcaModule } from 'src/wca/wca.module';

import { AuthModule } from '../auth/auth.module';
import { PersonController } from './person.controller';
import { PersonService } from './person.service';
import { PersonForDeviceService } from './personForDevice.service';

@Module({
  providers: [PersonService, PersonForDeviceService],
  controllers: [PersonController],
  exports: [PersonService, PersonForDeviceService],
  imports: [AuthModule, WcaModule],
})
export class PersonModule {}
