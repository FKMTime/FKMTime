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
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { OrganizerGuard } from 'src/auth/guards/organizer.guard';
import { ScramblingDeviceGuard } from 'src/auth/guards/scramblingDevice.guard';

import { GetUser } from '../auth/decorator/getUser.decorator';
import { JwtAuthDto } from '../auth/dto/jwt-auth.dto';
import { CompetitionService } from './competition.service';
import { ConnectIntegratedLiveDto } from './dto/connectIntegratedLive.dto';
import { UpdateCompetitionDto } from './dto/updateCompetition.dto';
import { UpdateRoomsDto } from './dto/updateCurrentRound.dto';
import { UpdateDevicesSettingsDto } from './dto/updateDevicesSettings.dto';
import { ImportService } from './import.service';
import { IntegratedLiveConnectionService } from './integratedLiveConnection.service';
import { RoomsService } from './rooms.service';
import { StatisticsService } from './statistics.service';
import { SyncService } from './sync.service';

const parseGroupIds = (groupIds?: string) =>
  groupIds?.split(',').filter(Boolean);

@Controller('competition')
export class CompetitionController {
  constructor(
    private readonly competitionService: CompetitionService,
    private readonly roomsService: RoomsService,
    private readonly importService: ImportService,
    private readonly syncService: SyncService,
    private readonly statisticsService: StatisticsService,
    private readonly integratedLiveConnectionService: IntegratedLiveConnectionService,
  ) {}

  @Get('login-info')
  async getCompetitionLoginInfo() {
    return await this.competitionService.getInfoForLoginPage();
  }

  @Get('public')
  async getPublicCompetitionInfo() {
    return await this.competitionService.getCompetitionInfo();
  }

  @Get('public/rooms')
  async getPublicRooms() {
    return await this.roomsService.getAllRooms();
  }

  @UseGuards(AuthGuard('jwt'))
  @Get()
  async getCompetitionInfo() {
    return await this.competitionService.getCompetitionForPanel();
  }

  @UseGuards(ScramblingDeviceGuard)
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

  @UseGuards(OrganizerGuard)
  @Get('settings')
  async getCompetitionSettings() {
    return await this.competitionService.getCompetitionSettings();
  }

  @UseGuards(AuthGuard('jwt'), OrganizerGuard)
  @Get('import/:id')
  async importCompetition(
    @Param('id') id: string,
    @GetUser() user: JwtAuthDto,
  ) {
    return await this.importService.importCompetition(id, user.userId);
  }

  @UseGuards(AuthGuard('jwt'), OrganizerGuard)
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

  @UseGuards(AuthGuard('jwt'))
  @Get('rooms/progress')
  async getRoomsProgress() {
    return this.roomsService.getRoomsProgress();
  }

  @UseGuards(OrganizerGuard)
  @Get('integrated-live/connection')
  async getIntegratedLiveConnection() {
    return await this.integratedLiveConnectionService.getStatus();
  }

  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'), OrganizerGuard)
  @Post('integrated-live/connection')
  async connectIntegratedLive(
    @Body() dto: ConnectIntegratedLiveDto,
    @GetUser() user: JwtAuthDto,
  ) {
    // Fresh, in case the competition was switched on the WCA in between. Done
    // here so the connection service needn't depend on CompetitionService.
    await this.competitionService
      .refreshWcaScoretakingSoftware()
      .catch(() => undefined);
    return await this.integratedLiveConnectionService.connect(
      user.userId,
      dto.code,
      dto.redirectUri,
    );
  }

  @UseGuards(OrganizerGuard)
  @Delete('integrated-live/connection')
  async disconnectIntegratedLive() {
    return await this.integratedLiveConnectionService.disconnect();
  }

  @HttpCode(HttpStatus.OK)
  @UseGuards(OrganizerGuard)
  @Post('scoretaking-software/refresh')
  async refreshScoretakingSoftware() {
    return await this.competitionService.refreshWcaScoretakingSoftware();
  }

  @UseGuards(OrganizerGuard)
  @Get('available-locales')
  async getAvailableLocales() {
    return this.competitionService.getAvailableLocales();
  }

  @UseGuards(OrganizerGuard)
  @Put('rooms')
  async updateRooms(@Body() dto: UpdateRoomsDto) {
    return this.roomsService.updateRooms(dto);
  }

  @UseGuards(OrganizerGuard)
  @Put('settings/:id')
  async updateCompetition(
    @Param('id') id: string,
    @Body() dto: UpdateCompetitionDto,
  ) {
    return await this.competitionService.updateCompetition(id, dto);
  }

  @UseGuards(OrganizerGuard)
  @Get('settings/:id/devices')
  async getDevicesSettings() {
    return await this.competitionService.getDevicesSettings();
  }

  @UseGuards(OrganizerGuard)
  @Put('settings/:id/devices')
  async updateDevicesSettings(
    @Param('id') id: string,
    @Body() dto: UpdateDevicesSettingsDto,
  ) {
    return await this.competitionService.updateDevicesSettings(id, dto);
  }

  @UseGuards(OrganizerGuard)
  @Get('rooms/:id/next-groups')
  async getNextGroupsFromScheduleForRoom(
    @Param('id') id: string,
    @Query('groupIds') groupIds?: string,
  ) {
    return await this.competitionService.getNextGroupsFromScheduleForRoom(
      id,
      parseGroupIds(groupIds),
    );
  }

  @UseGuards(OrganizerGuard)
  @Get('rooms/:id/previous-groups')
  async getPreviousGroupsFromScheduleForRoom(
    @Param('id') id: string,
    @Query('groupIds') groupIds?: string,
  ) {
    return await this.competitionService.getPreviousGroupsFromScheduleForRoom(
      id,
      parseGroupIds(groupIds),
    );
  }
}
