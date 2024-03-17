import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { Injectable, UnauthorizedException } from '@nestjs/common';
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
  constructor() {
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

    return { userId, role };
  }
}
