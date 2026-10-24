import { HttpException, Injectable } from '@nestjs/common';
import { SyncService } from 'src/competition/sync.service';
import { DbService } from 'src/db/db.service';

import { eventsData, isUnofficialEvent } from '../events';
import { CreateUnofficialEventDto } from './dto/createUnofficialEvent.dto';
import { UpdateUnofficialEventDto } from './dto/updateUnofficialEvent.dto';

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: DbService,
    private readonly syncService: SyncService,
  ) {}

  getAllEvents() {
    return eventsData;
  }

  async getUnofficialEvents() {
    return await this.prisma.unofficialEvent.findMany();
  }

  async createUnofficialEvent(data: CreateUnofficialEventDto) {
    const { eventId, rounds } = data;
    // An official event (FTO included, since WCIF v2) comes from the WCA
    // website; saved here it would never reach the competition WCIF
    if (!isUnofficialEvent(eventId)) {
      throw new HttpException(
        'Only unofficial events can be added here. Official events come from the WCA website.',
        400,
      );
    }
    const existingEvent = await this.prisma.unofficialEvent.findFirst({
      where: { eventId: eventId },
    });
    if (existingEvent) {
      throw new HttpException('Unofficial event already exists.', 409);
    }
    const wcif = {
      id: eventId,
      rounds: rounds,
      extensions: [],
      qualification: null,
    };
    await this.prisma.unofficialEvent.create({
      data: {
        eventId: eventId,
        wcif: wcif,
      },
    });
    await this.syncService.addUnofficialEventsToWcif();
    return {
      message: 'Unofficial event created successfully.',
    };
  }

  async updateUnofficialEvent(id: string, data: UpdateUnofficialEventDto) {
    const { wcif } = data;
    const existingEvent = await this.prisma.unofficialEvent.findFirst({
      where: { id },
    });
    if (!existingEvent) {
      throw new HttpException('Unofficial event does not exist.', 404);
    }
    await this.prisma.unofficialEvent.update({
      where: { id },
      data: {
        wcif: wcif,
      },
    });
    await this.syncService.addUnofficialEventsToWcif();
    return {
      message: 'Unofficial event updated successfully.',
    };
  }

  async deleteUnofficialEvent(id: string) {
    const existingEvent = await this.prisma.unofficialEvent.findFirst({
      where: { id },
    });
    if (!existingEvent) {
      throw new HttpException('Unofficial event does not exist.', 404);
    }

    const anyResult = await this.prisma.result.findFirst({
      where: { eventId: existingEvent.eventId },
    });

    if (anyResult) {
      throw new HttpException(
        'Cannot delete unofficial event with results.',
        409,
      );
    }
    await this.prisma.unofficialEvent.delete({
      where: { id },
    });
    await this.syncService.addUnofficialEventsToWcif();
    return {
      message: 'Unofficial event deleted successfully.',
    };
  }
}
