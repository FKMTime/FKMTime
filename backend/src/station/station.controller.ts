import { AuthService } from './../auth/auth.service';
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { StationService } from './station.service';
import { StationDto } from './dto/station.dto';
import { AuthGuard } from '@nestjs/passport';
import { GetUser } from 'src/auth/decorator/getUser.decorator';
import { JwtAuthDto } from 'src/auth/dto/jwt-auth.dto';

@UseGuards(AuthGuard('jwt'))
@Controller('station')
export class StationController {
  constructor(
    private readonly stationService: StationService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  async getAllStations(@GetUser() user: JwtAuthDto) {
    await this.authService.requireAdminRole(user.userId);
    return await this.stationService.getAllStations();
  }

  @Post()
  async createStation(@Body() data: StationDto, @GetUser() user: JwtAuthDto) {
    await this.authService.requireAdminRole(user.userId);
    return await this.stationService.createStation(data);
  }
}
