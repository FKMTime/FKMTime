import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';

import { AuthService } from '../auth.service';

@Injectable()
export class DelegateGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    let token = '';
    if (req.hasOwnProperty('handshake')) {
      token = req.handshake.auth.token;
    }
    if (req && req.headers && req.headers.authorization) {
      token = req.headers.authorization.split(' ')[1];
    }
    const user = await this.authService.validateJwt(token);
    return !(
      !user ||
      ![Role.DELEGATE].some(
        (role) =>
          user.roles.includes(role as Role) || user.roles.includes(Role.ADMIN),
      )
    );
  }
}
