import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

import { ScramblingDeviceService } from './../../scrambling-device/scrambling-device.service';

@Injectable()
export class ScramblingDeviceGuard implements CanActivate {
  constructor(
    private readonly scramblingDeviceService: ScramblingDeviceService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    let token = '';
    if (req && req.headers && req.headers.authorization) {
      token = req.headers.authorization.split('Token ')[1];
    }
    const isTokenValid = await this.scramblingDeviceService.isTokenValid({
      token,
    });
    return isTokenValid;
  }
}
