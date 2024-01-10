import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { JwtAuthDto } from '../dto/jwt-auth.dto';

@Injectable()
export class DelegateGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const req = context.switchToHttp().getRequest();
    const user: JwtAuthDto = req.user;

    if (user.role === 'DELEGATE') return true;
    throw new HttpException(
      {
        status: HttpStatus.FORBIDDEN,
        error: 'You must be an admin to perform this action',
      },
      HttpStatus.FORBIDDEN,
    );
  }
}
