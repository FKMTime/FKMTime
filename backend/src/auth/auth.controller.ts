import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { AuthService } from './auth.service';
import { GetUser } from './decorator/getUser.decorator';
import { ChangePasswordDto } from './dto/changePassword.dto';
import { JwtAuthDto } from './dto/jwt-auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  async getUserInfo(@GetUser() user: JwtAuthDto) {
    return await this.authService.getUserInfo(user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Put('password/change')
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @GetUser() user: JwtAuthDto,
  ) {
    await this.authService.changePassword(
      user.userId,
      dto.oldPassword,
      dto.newPassword,
    );
  }
}
