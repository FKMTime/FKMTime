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
import { AdminOrDelegateGuard } from '../auth/guards/adminOrDelegate.guard';
import { QuickActionDto } from './dto/quickAction.dto';
import { UpdateSettingsDto } from './dto/updateSettings.dto';
import { JwtAuthDto } from '../auth/dto/jwt-auth.dto';
import { GetUser } from 'src/auth/decorator/getUser.decorator';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get()
  async getSettings(@GetUser() user: JwtAuthDto) {
    return await this.settingsService.getSettings(user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Put()
  async updateSettings(
    @Body() data: UpdateSettingsDto,
    @GetUser() user: JwtAuthDto,
  ) {
    return await this.settingsService.updateSettings(user.userId, data);
  }

  @UseGuards(AuthGuard('jwt'), AdminOrDelegateGuard)
  @Get('quick-actions')
  async getMyQuickActions(@GetUser() user: JwtAuthDto) {
    return this.settingsService.getMyQuickActions(user.userId);
  }

  @UseGuards(AuthGuard('jwt'), AdminOrDelegateGuard)
  @Post('quick-actions')
  async createQuickAction(
    @Body() data: QuickActionDto,
    @GetUser() user: JwtAuthDto,
  ) {
    return await this.settingsService.createQuickAction(user.userId, data);
  }

  @UseGuards(AuthGuard('jwt'), AdminOrDelegateGuard)
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

  @UseGuards(AuthGuard('jwt'), AdminOrDelegateGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('quick-actions/:id')
  async deleteQuickAction(
    @GetUser() user: JwtAuthDto,
    @Param('id') quickActionId: string,
  ) {
    return this.settingsService.deleteQuickAction(user.userId, quickActionId);
  }
}
