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
import { AdminGuard } from 'src/auth/guards/admin.guard';

import { CreateUnofficialEventDto } from './dto/createUnofficialEvent.dto';
import { EventsService } from './events.service';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  getAllEvents() {
    return this.eventsService.getAllEvents();
  }

  @UseGuards(AdminGuard)
  @Get('unofficial')
  getUnofficialEvents() {
    return this.eventsService.getUnofficialEvents();
  }

  @UseGuards(AdminGuard)
  @Post()
  async createUnofficialEvent(@Body() data: CreateUnofficialEventDto) {
    return this.eventsService.createUnofficialEvent(data);
  }

  @UseGuards(AdminGuard)
  @Put(':id')
  async updateUnofficialEvent(@Param('id') id: string, @Body() data: any) {
    return this.eventsService.updateUnofficialEvent(id, data);
  }

  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async deleteUnofficialEvent(@Param('id') id: string) {
    return this.eventsService.deleteUnofficialEvent(id);
  }
}
