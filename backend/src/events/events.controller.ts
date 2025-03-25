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
import { OrganizerGuard } from 'src/auth/guards/organizer.guard';

import { CreateUnofficialEventDto } from './dto/createUnofficialEvent.dto';
import { EventsService } from './events.service';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  getAllEvents() {
    return this.eventsService.getAllEvents();
  }

  @UseGuards(OrganizerGuard)
  @Get('unofficial')
  getUnofficialEvents() {
    return this.eventsService.getUnofficialEvents();
  }

  @UseGuards(OrganizerGuard)
  @Post()
  async createUnofficialEvent(@Body() data: CreateUnofficialEventDto) {
    return this.eventsService.createUnofficialEvent(data);
  }

  @UseGuards(OrganizerGuard)
  @Put(':id')
  async updateUnofficialEvent(@Param('id') id: string, @Body() data: any) {
    return this.eventsService.updateUnofficialEvent(id, data);
  }

  @UseGuards(OrganizerGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async deleteUnofficialEvent(@Param('id') id: string) {
    return this.eventsService.deleteUnofficialEvent(id);
  }
}
