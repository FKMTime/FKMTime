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

@Controller('competition')
export class CompetitionController {
  constructor(private readonly competitionService: CompetitionService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get()
  async getCompetitionInfo() {
    return await this.competitionService.getCompetitionInfo();
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('statistics')
  async getCompetitionStatistics() {
    return await this.competitionService.getCompetitionStatistics();
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
    return await this.competitionService.importCompetition(id, user.userId);
  }

  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Get('sync/:id')
  async syncCompetition(@Param('id') id: string, @GetUser() user: JwtAuthDto) {
    return await this.competitionService.updateWcif(id, user.userId);
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
    return this.competitionService.getAllRooms();
  }

  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Put('rooms')
  async updateRooms(@Body() dto: UpdateRoomsDto) {
    return this.competitionService.updateRooms(dto);
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
