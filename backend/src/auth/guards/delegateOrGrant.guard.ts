import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { DelegateGrantService } from 'src/delegate-grant/delegateGrant.service';

import { AuthService } from '../auth.service';

/**
 * Lets through delegates, admins, and users holding delegate access for a
 * group (SPEC-013). It only answers "might be allowed": the endpoint asks
 * DelegateGrantService.authorize whether this action on this competitor is.
 */
@Injectable()
export class DelegateOrGrantGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly delegateGrantService: DelegateGrantService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    let token: string | null = null;
    if (req.hasOwnProperty('handshake')) {
      token = req.handshake.auth.token;
    }
    if (req && req.headers && req.headers.authorization) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) throw new UnauthorizedException();
    const user = await this.authService.validateJwt(token);
    if (!user) return false;
    if (await this.delegateGrantService.mightBeAllowed(user)) return true;
    // Say why: "Your delegate access for … has ended" reads better than
    // "Forbidden resource" on a page opened while it was active
    throw new ForbiddenException(
      await this.delegateGrantService.noActiveGrantReason(user.userId),
    );
  }
}
