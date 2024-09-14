import { forwardRef, Module } from '@nestjs/common';

import { AuthModule } from '../auth.module';
import { LoginController } from './login.controller';

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [LoginController],
})
export class LoginModule {}
