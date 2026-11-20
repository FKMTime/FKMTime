import { forwardRef, Global, Module } from '@nestjs/common';
import { AppModule } from 'src/app.module';
import { DelegateOrGrantGuard } from 'src/auth/guards/delegateOrGrant.guard';

import { DelegateGrantController } from './delegateGrant.controller';
import { DelegateGrantService } from './delegateGrant.service';

/** Global: the attempt, result and incident endpoints all check grants */
@Global()
@Module({
  imports: [forwardRef(() => AppModule)],
  providers: [DelegateGrantService, DelegateOrGrantGuard],
  controllers: [DelegateGrantController],
  exports: [DelegateGrantService, DelegateOrGrantGuard],
})
export class DelegateGrantModule {}
