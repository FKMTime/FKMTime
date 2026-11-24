import { forwardRef, Module } from '@nestjs/common';
import { AppModule } from 'src/app.module';

import { H2hController } from './h2h.controller';
import { H2hService } from './h2h.service';
import { H2hMatchService } from './h2hMatch.service';

@Module({
  providers: [H2hService, H2hMatchService],
  controllers: [H2hController],
  imports: [forwardRef(() => AppModule)],
  exports: [H2hMatchService],
})
export class H2hModule {}
