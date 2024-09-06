import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { AuthModule } from 'src/auth/auth.module';
import { UserController } from './user.controller';
import { WcaModule } from 'src/wca/wca.module';

@Module({
  providers: [UserService],
  controllers: [UserController],
  imports: [AuthModule, WcaModule],
})
export class UserModule {}
