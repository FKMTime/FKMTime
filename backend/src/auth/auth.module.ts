import { forwardRef, Module } from '@nestjs/common';
import { WcaModule } from '../wca/wca.module';
import { AuthController } from './auth.controller';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategy/jwt.strategy';
import { JwtModule } from '@nestjs/jwt';
import { LoginModule } from './login/login.module';
import { WcaController } from './wca/wca.controller';

const { SECRET: secret = 'secret' } = process.env;

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
  ],
  controllers: [AuthController, WcaController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtStrategy, PassportModule],
})
export class AuthModule {}
