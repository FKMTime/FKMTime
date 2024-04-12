import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { WcaLoginDto } from '../dto/wcaLogin.dto';

@Controller('auth/wca')
export class WcaController {
  constructor(private readonly authService: AuthService) {}

  @HttpCode(HttpStatus.OK)
  @Post('login')
  async loginWithWca(@Body() data: WcaLoginDto) {
    return this.authService.loginWithWca(data);
  }
}
