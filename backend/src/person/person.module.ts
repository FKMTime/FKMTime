import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PersonController } from './person.controller';
import { PersonService } from './person.service';

@Module({
  providers: [PersonService],
  controllers: [PersonController],
  exports: [PersonService],
  imports: [AuthModule],
})
export class PersonModule {}
