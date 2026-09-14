import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

import { AuthService } from '../auth.service';
import { WcaLoginDto } from '../dto/wcaLogin.dto';

@Controller('auth/wca')
export class WcaController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async loginWithWca(@Body() data: WcaLoginDto) {
    return this.authService.loginWithWca(data);
  }
}
