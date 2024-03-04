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

  @Put(':id')
  async updateStation(@Param('id') id: number, @Body() data: StationDto) {
    return await this.stationService.updateStation(id, data);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async deleteStation(@Param('id') id: number) {
    return await this.stationService.deleteStation(id);
  }
}
