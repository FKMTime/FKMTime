import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { StationService } from './station.service';
import { StationDto } from './dto/station.dto';
import { AdminGuard } from 'src/auth/guards/admin.guard';

@UseGuards(AdminGuard)
@Controller('station')
export class StationController {
  constructor(private readonly stationService: StationService) {}

  @Get()
  async getAllStations() {
    return await this.stationService.getAllStations();
  }

  @Post()
  async createStation(@Body() data: StationDto) {
    return await this.stationService.createStation(data);
  }
}
