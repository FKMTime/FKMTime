import { AuthGuard } from '@nestjs/passport';

export class AdminGuard extends AuthGuard('jwt') {
  handleRequest(err, user) {
    if (!user || user.role !== 'ADMIN') {
      return false;
    }
    return user;
  }
}
