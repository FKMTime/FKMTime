import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AddStaffMemberDto } from './dto/addStaffMember.dto';
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
  ) {
    return await this.personService.getPersons(
      +page,
      +pageSize,
      search,
      +registrantId,
      withoutCardAssigned,
      cardId,
      onlyNewcomers,
    );
  }

  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Post('staff')
  async addStaffMember(@Body() data: AddStaffMemberDto) {
    return await this.personService.addStaffMember(data);
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
  @Get('check-in/:id')
  async checkIn(@Param('id') id: string) {
    return await this.personService.checkIn(id);
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
