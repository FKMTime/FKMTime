import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';

/**
 * Hides a route everywhere but the dev stack. It answers 404 and runs before
 * authentication, so elsewhere the route looks like it doesn't exist.
 */
@Injectable()
export class DevOnlyGuard implements CanActivate {
  canActivate() {
    if (process.env.NODE_ENV !== 'development') {
      throw new NotFoundException();
    }
    return true;
  }
}
