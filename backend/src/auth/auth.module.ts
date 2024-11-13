import { forwardRef, Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ScramblingDeviceModule } from 'src/scrambling-device/scrambling-device.module';

import { WcaModule } from '../wca/wca.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginModule } from './login/login.module';
import { JwtStrategy } from './strategy/jwt.strategy';
import { WcaController } from './wca/wca.controller';

const { SECRET: secret = 'secret' } = process.env;

@Global()
@Module({
  imports: [
    forwardRef(() => LoginModule),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret,
      signOptions: { expiresIn: 3600 * 24 * 30 },
    }),
    LoginModule,
    WcaModule,
    ScramblingDeviceModule,
  ],
  controllers: [AuthController, WcaController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtStrategy, PassportModule],
})
export class AuthModule {}
