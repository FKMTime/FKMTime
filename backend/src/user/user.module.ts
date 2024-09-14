import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { WcaModule } from 'src/wca/wca.module';

import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  providers: [UserService],
  controllers: [UserController],
  imports: [AuthModule, WcaModule],
})
export class UserModule {}
