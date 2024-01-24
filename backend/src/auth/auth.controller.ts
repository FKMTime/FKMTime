import { Body, Controller, Post, Put, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { GetUser } from './decorator/getUser.decorator';
import { JwtAuthDto } from './dto/jwt-auth.dto';
import { ChangePasswordDto } from './dto/changePassword.dto';
import { AuthGuard } from '@nestjs/passport';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(AuthGuard('jwt'))
  @Post('register')
  async registerAccount(@Body() dto: RegisterDto, @GetUser() user: JwtAuthDto) {
    await this.authService.requireAdminRole(user.userId);
    return await this.authService.registerAccount(dto);
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
