import {
  Body,
  Controller,
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

import { AdminGuard } from '../auth/guards/admin.guard';
import { AddPersonDto } from './dto/addPerson.dto';
import { UpdatePersonDto } from './dto/updatePerson.dto';
import { PersonService } from './person.service';

@Controller('person')
export class PersonController {
  constructor(private readonly personService: PersonService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get()
  async getPersons(
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 10,
    @Query('search') search?: string,
    @Query('registrantId') registrantId?: number,
    @Query('withoutCardAssigned') withoutCardAssigned?: boolean,
    @Query('cardId') cardId?: string,
    @Query('onlyNewcomers') onlyNewcomers?: boolean,
    @Query('onlyNotCheckedIn') onlyNotCheckedIn?: boolean,
  ) {
    return await this.personService.getPersons(
      +page,
      +pageSize,
      search,
      +registrantId,
      withoutCardAssigned,
      cardId,
      onlyNewcomers,
      onlyNotCheckedIn,
    );
  }

  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Post()
  async addPerson(@Body() data: AddPersonDto) {
    return await this.personService.addPerson(data);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('all')
  async getAllPersons() {
    return this.personService.getAllPersons();
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('without-card')
  async getPersonsWithoutCardAssigned() {
    return this.personService.getPersonsWithoutCardAssigned();
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('card/:cardId/sensitive')
  async getPersonInfoSensitive(@Param('cardId') cardId: string) {
    return await this.personService.getPersonInfoWithSensitiveData(cardId);
  }

  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  @Post('check-in/:id')
  async checkIn(@Param('id') id: string, @Body() data: UpdatePersonDto) {
    return await this.personService.checkIn(id, data);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('check-in')
  async checkedInCount() {
    return await this.personService.checkedInCount();
  }

  @UseGuards(AuthGuard('jwt'))
  @Get(':id')
  async getPersonById(@Param('id') id: string) {
    return await this.personService.getPersonById(id);
  }

  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Put(':id')
  async updatePerson(@Param('id') id: string, @Body() data: UpdatePersonDto) {
    return await this.personService.updatePerson(id, data);
  }
}
