import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';

/**
 * On in the dev stack, and wherever STATION_TESTER_ENABLED=true, which only
 * PR previews set. Anywhere else the tester must stay off: it lets anyone
 * signed in send any packet as any station, results included.
 */
export const isStationTesterEnabled = () =>
  process.env.NODE_ENV === 'development' ||
  process.env.STATION_TESTER_ENABLED === 'true';

/**
 * Hides the station tester wherever it is off. It answers 404 and runs before
 * authentication, so there the route looks like it doesn't exist.
 */
@Injectable()
export class StationTesterEnabledGuard implements CanActivate {
  canActivate() {
    if (!isStationTesterEnabled()) {
      throw new NotFoundException();
    }
    return true;
  }
}
