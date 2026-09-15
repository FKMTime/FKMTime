import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class DbService extends PrismaClient implements OnModuleDestroy {
  constructor(config: ConfigService) {
    super({
      datasources: {
        db: {
          url: config.get('DATABASE_URL'),
        },
      },
      log: [{ emit: 'stdout', level: 'error' }],
      errorFormat: 'colorless',
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
