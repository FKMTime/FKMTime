import { Module } from '@nestjs/common';
import { PersonService } from './person.service';
import { PersonController } from './person.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  providers: [PersonService],
  controllers: [PersonController],
  exports: [PersonService],
  imports: [AuthModule],
})
export class PersonModule {}
