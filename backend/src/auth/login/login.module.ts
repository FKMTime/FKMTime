import { forwardRef, Module } from '@nestjs/common';
import { LoginController } from './login.controller';
import { AuthModule } from '../auth.module';

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [LoginController],
})
export class LoginModule {}
