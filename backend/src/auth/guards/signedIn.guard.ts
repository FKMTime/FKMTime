import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { AuthService } from '../auth.service';

/**
 * Any signed-in user, for socket.io handlers. Leaves the user id on the
 * socket (socket.data.userId), which HTTP's AuthGuard('jwt') would put on
 * req.user.
 */
@Injectable()
export class SignedInGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const socket = context.switchToWs().getClient();
    const token: string | undefined = socket?.handshake?.auth?.token;
    if (!token) throw new UnauthorizedException();
    const user = await this.authService.validateJwt(token);
    if (!user) return false;
    socket.data = { ...socket.data, userId: user.userId };
    return true;
  }
}
