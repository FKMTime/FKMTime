import { DbService } from './../db/db.service';
import { Injectable } from '@nestjs/common';
import { StationDto } from './dto/station.dto';

@Injectable()
export class StationService {
  constructor(private readonly prisma: DbService) {}

  async getAllStations() {
    return this.prisma.station.findMany();
  }

  async createStation(data: StationDto) {
    return this.prisma.station.create({
      data: {
        name: data.name,
        espId: data.espId,
      },
    });
  }

  async updateStation(id: string, data: StationDto) {
    return this.prisma.station.update({
      where: { id },
      data: {
        name: data.name,
        espId: data.espId,
      },
    });
  }

  async deleteStation(id: string) {
    return this.prisma.station.delete({
      where: { id },
    });
  }
}
