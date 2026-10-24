import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class DbService extends PrismaClient implements OnModuleDestroy {
  constructor(config: ConfigService) {
    super({
      adapter: new PrismaPg({
        connectionString: config.get('DATABASE_URL'),
      }),
      log: [{ emit: 'stdout', level: 'error' }],
      // signKey is the key a station signs its packets with. Only the
      // stations themselves need it, so no query returns it unless it opts
      // back in with omit: { signKey: false }
      omit: { device: { signKey: true } },
      errorFormat: 'colorless',
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
