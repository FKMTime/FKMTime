import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { GetUser } from './decorator/getUser.decorator';
import { JwtAuthDto } from './dto/jwt-auth.dto';
import { ChangePasswordDto } from './dto/changePassword.dto';
import { AuthGuard } from '@nestjs/passport';
import { RegisterDto } from './dto/register.dto';
import { AdminGuard } from './guards/admin.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(AdminGuard)
  @Post('register')
  async registerAccount(@Body() dto: RegisterDto) {
    return await this.authService.registerAccount(dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  async getAccountInfo(@GetUser() user: JwtAuthDto) {
    return await this.authService.getAccountInfo(user.userId);
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
