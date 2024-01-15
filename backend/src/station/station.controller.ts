import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/guards/admin.guard';
import { StationService } from './station.service';
import { StationDto } from './dto/station.dto';

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
