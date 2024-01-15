import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UpdateSettingsDto } from './dto/updateSettings.dto';
import { JwtAuthDto } from '../auth/dto/jwt-auth.dto';
import { GetUser } from 'src/auth/decorator/getUser.decorator';
import { SettingsService } from './settings.service';

@UseGuards(AuthGuard('jwt'))
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async getSettings(@GetUser() user: JwtAuthDto) {
    return await this.settingsService.getSettings(user.userId);
  }

  @Put()
  async updateSettings(
    @Body() data: UpdateSettingsDto,
    @GetUser() user: JwtAuthDto,
  ) {
    return await this.settingsService.updateSettings(user.userId, data);
  }
}
