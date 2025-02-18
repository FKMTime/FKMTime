import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GetUser } from 'src/auth/decorator/getUser.decorator';
import { DelegateGuard } from 'src/auth/guards/delegate.guard';

import { JwtAuthDto } from '../auth/dto/jwt-auth.dto';
import { QuickActionDto } from './dto/quickAction.dto';
import { UpdateSettingsDto } from './dto/updateSettings.dto';
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

  @UseGuards(DelegateGuard)
  @Get('quick-actions')
  async getMyQuickActions(@GetUser() user: JwtAuthDto) {
    return this.settingsService.getMyQuickActions(user.userId);
  }

  @UseGuards(DelegateGuard)
  @Post('quick-actions')
  async createQuickAction(
    @Body() data: QuickActionDto,
    @GetUser() user: JwtAuthDto,
  ) {
    return await this.settingsService.createQuickAction(user.userId, data);
  }

  @UseGuards(DelegateGuard)
  @Put('quick-actions/:id')
  async updateQuickAction(
    @Body() data: QuickActionDto,
    @GetUser() user: JwtAuthDto,
    @Param('id') quickActionId: string,
  ) {
    return await this.settingsService.updateQuickAction(
      user.userId,
      quickActionId,
      data,
    );
  }

  @UseGuards(DelegateGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('quick-actions/:id')
  async deleteQuickAction(
    @GetUser() user: JwtAuthDto,
    @Param('id') quickActionId: string,
  ) {
    return this.settingsService.deleteQuickAction(user.userId, quickActionId);
  }
}
