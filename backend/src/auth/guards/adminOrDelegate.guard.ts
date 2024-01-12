import { AuthGuard } from '@nestjs/passport';

export class AdminOrDelegateGuard extends AuthGuard('jwt') {
  handleRequest(err, user) {
    if (!user || user.role !== 'ADMIN' || user.role !== 'DELEGATE') {
      return false;
    }
    return user;
  }
}
