import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { DbService } from './db.service';
import { StoredWcifService } from './storedWcif.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [DbService, ConfigService, StoredWcifService],
  exports: [DbService, StoredWcifService],
})
export class DbModule {}
