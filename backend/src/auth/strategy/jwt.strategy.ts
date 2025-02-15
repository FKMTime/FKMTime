import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';

import { AuthService } from '../auth.service';
import { JwtAuthDto } from '../dto/jwt-auth.dto';

const { SECRET = 'secret' } = process.env;

const extractFromHeader = (req: any): string | null => {
  if (req.hasOwnProperty('handshake')) {
    return req.handshake.auth.token;
  }
  if (req && req.headers && req.headers.authorization) {
    return req.headers.authorization.split(' ')[1];
  }
  return null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: extractFromHeader,
      secretOrKey: SECRET,
    });
  }

  async validate(payload: any): Promise<JwtAuthDto> {
    const { userId, role } = payload;

    if (!userId || !role) {
      throw new UnauthorizedException('Invalid token payload');
    }

    const userExists = await this.authService.userExists(userId);

    if (!userExists) {
      throw new UnauthorizedException('User not found');
    }

    return { userId, role };
  }
}
