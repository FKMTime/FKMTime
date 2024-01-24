import { Module } from '@nestjs/common';
import { AccountService } from './account.service';
import { AccountController } from './account.controller';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  providers: [AccountService],
  controllers: [AccountController],
  imports: [AuthModule],
})
export class AccountModule {}
