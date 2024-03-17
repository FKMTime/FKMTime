import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class AdminOrDelegateGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const allowedRoles = ['ADMIN', 'DELEGATE'];
    const req = context.switchToHttp().getRequest();
    let token = '';
    if (req.hasOwnProperty('handshake')) {
      token = req.handshake.auth.token;
    }
    if (req && req.headers && req.headers.authorization) {
      token = req.headers.authorization.split(' ')[1];
    }
    const user = await this.authService.validateJwt(token);
    return !(!user || !allowedRoles.includes(user.role));
  }
}
