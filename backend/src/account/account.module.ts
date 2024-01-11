import { Module } from '@nestjs/common';
import { AccountService } from './account.service';
import { AccountController } from './account.controller';

@Module({
  providers: [AccountService],
  controllers: [AccountController]
})
export class AccountModule {}
