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
import { GetUser } from 'src/auth/decorator/getUser.decorator';
import { JwtAuthDto } from 'src/auth/dto/jwt-auth.dto';
import { OrganizerGuard } from 'src/auth/guards/organizer.guard';

import { AddPersonDto } from './dto/addPerson.dto';
import { ChangeCompetingGroupDto } from './dto/changeCompetingGroup.dto';
import { UpdatePersonDto } from './dto/updatePerson.dto';
import { PersonService } from './person.service';

@UseGuards(AuthGuard('jwt'))
@Controller('person')
export class PersonController {
  constructor(private readonly personService: PersonService) {}

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

  @UseGuards(OrganizerGuard)
  @Post()
  async addPerson(@Body() data: AddPersonDto) {
    return await this.personService.addPerson(data);
  }

  @Get('all')
  async getAllPersons(
    @Query('withoutCardAssigned') withoutCardAssigned = false,
    @Query('search') search?: string,
  ) {
    return this.personService.getAllPersons(withoutCardAssigned, search);
  }

  @Get('without-card')
  async getPersonsWithoutCardAssigned() {
    return this.personService.getPersonsWithoutCardAssigned();
  }

  @Get('card/:cardId/sensitive')
  async getPersonInfoSensitive(@Param('cardId') cardId: string) {
    return await this.personService.getPersonInfoWithSensitiveData(cardId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('check-in/:id')
  async checkIn(@Param('id') id: string, @Body() data: UpdatePersonDto) {
    return await this.personService.checkIn(id, data);
  }

  @Get('check-in')
  async checkedInCount() {
    return await this.personService.checkedInCount();
  }

  @Get(':id')
  async getPersonById(@Param('id') id: string) {
    return await this.personService.getPersonById(id);
  }

  @Put(':id')
  async updatePerson(@Param('id') id: string, @Body() data: UpdatePersonDto) {
    return await this.personService.updatePerson(id, data);
  }

  @UseGuards(OrganizerGuard)
  @HttpCode(HttpStatus.OK)
  @Post('change-group')
  async changeCompetingGroup(
    @GetUser() user: JwtAuthDto,
    @Body() data: ChangeCompetingGroupDto,
  ) {
    return await this.personService.changeCompetingGroup(user.userId, data);
  }
}
