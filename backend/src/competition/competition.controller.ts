import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard } from 'src/auth/guards/admin.guard';

import { GetUser } from '../auth/decorator/getUser.decorator';
import { JwtAuthDto } from '../auth/dto/jwt-auth.dto';
import { CompetitionService } from './competition.service';
import { UpdateCompetitionDto } from './dto/updateCompetition.dto';
import { UpdateRoomsDto } from './dto/updateCurrentRound.dto';
import { UpdateDevicesSettingsDto } from './dto/updateDevicesSettings.dto';
import { ImportService } from './import.service';
import { RoomsService } from './rooms.service';
import { StatisticsService } from './statistics.service';
import { SyncService } from './sync.service';

@Controller('competition')
export class CompetitionController {
  constructor(
    private readonly competitionService: CompetitionService,
    private readonly roomsService: RoomsService,
    private readonly importService: ImportService,
    private readonly syncService: SyncService,
    private readonly statisticsService: StatisticsService,
  ) {}

  @UseGuards(AuthGuard('jwt'))
  @Get()
  async getCompetitionInfo() {
    return await this.competitionService.getCompetitionInfo();
  }

  @Get('for/scrambling-device')
  async getCompetitionInfoForScramblingDevice() {
    return await this.competitionService.getCompetitionInfo();
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('statistics')
  async getCompetitionStatistics() {
    return await this.statisticsService.getCompetitionStatistics();
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('rounds')
  async getCompetitionRounds() {
    return await this.competitionService.getRoundsInfo();
  }

  @UseGuards(AdminGuard)
  @Get('settings')
  async getCompetitionSettings() {
    return await this.competitionService.getCompetitionSettings();
  }

  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Get('import/:id')
  async importCompetition(
    @Param('id') id: string,
    @GetUser() user: JwtAuthDto,
  ) {
    return await this.importService.importCompetition(id, user.userId);
  }

  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Get('sync/:id')
  async syncCompetition(@Param('id') id: string, @GetUser() user: JwtAuthDto) {
    return await this.syncService.updateWcif(id, user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('activities')
  async getActivitiesWithRealEndTime(
    @Query('venueId') venueId: number,
    @Query('roomId') roomId: number,
    @Query('date') date: Date,
  ) {
    return await this.competitionService.getActivitiesWithRealEndTime(
      +venueId,
      +roomId,
      new Date(date),
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('rooms')
  async getAllRooms() {
    return this.roomsService.getAllRooms();
  }

  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Get('available-locales')
  async getAvailableLocales() {
    return this.competitionService.getAvailableLocales();
  }

  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Put('rooms')
  async updateRooms(@Body() dto: UpdateRoomsDto) {
    return this.roomsService.updateRooms(dto);
  }

  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Put('settings/:id')
  async updateCompetition(
    @Param('id') id: string,
    @Body() dto: UpdateCompetitionDto,
  ) {
    return await this.competitionService.updateCompetition(id, dto);
  }

  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Get('settings/:id/devices')
  async getDevicesSettings() {
    return await this.competitionService.getDevicesSettings();
  }

  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Put('settings/:id/devices')
  async updateDevicesSettings(
    @Param('id') id: string,
    @Body() dto: UpdateDevicesSettingsDto,
  ) {
    return await this.competitionService.updateDevicesSettings(id, dto);
  }
}
