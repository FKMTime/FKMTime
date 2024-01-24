import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const token = req.headers.authorization?.split(' ')[1];
    const user = await this.authService.validateJwt(token);
    if (!user || user.role !== 'ADMIN') {
      return false;
    }
    return true;
  }
}
