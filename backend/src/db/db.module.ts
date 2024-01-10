import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DbService } from './db.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [DbService, ConfigService],
  exports: [DbService],
})
export class DbModule {}
