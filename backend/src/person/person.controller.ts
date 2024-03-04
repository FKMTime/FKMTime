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
import { PersonService } from './person.service';
import { UpdatePersonDto } from './dto/updatePerson.dto';
import { AuthGuard } from '@nestjs/passport';
import { AssignManyCardsDto } from './dto/assignManyCards.dto';
import { AdminOrDelegateGuard } from '../auth/guards/adminOrDelegate.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AddStaffMemberDto } from './dto/addStaffMember.dto';

@Controller('person')
export class PersonController {
  constructor(private readonly personService: PersonService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get()
  async getPersons(
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 10,
    @Query('search') search?: string,
  ) {
    return await this.personService.getPersons(+page, +pageSize, search);
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

  @UseGuards(AuthGuard('jwt'), AdminOrDelegateGuard)
  @Put('card/assign-many')
  async assignManyCards(@Body() data: AssignManyCardsDto) {
    return await this.personService.assignManyCards(data);
  }

  @Get('card/:cardId')
  async getPersonInfo(@Param('cardId') cardId: string) {
    return await this.personService.getPersonInfo(cardId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('card/:cardId/sensitive')
  async getPersonInfoSensitive(@Param('cardId') cardId: string) {
    return await this.personService.getPersonInfoWithSensitiveData(cardId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('giftpack/:id')
  async collectGiftpack(@Param('id') id: number) {
    return await this.personService.collectGiftpack(+id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('giftpack')
  async giftpackCount() {
    return await this.personService.giftpackCount();
  }

  @UseGuards(AuthGuard('jwt'))
  @Get(':id')
  async getPersonById(@Param('id') id: number) {
    return await this.personService.getPersonById(+id);
  }

  @UseGuards(AuthGuard('jwt'), AdminOrDelegateGuard)
  @Put(':id')
  async updatePerson(@Param('id') id: number, @Body() data: UpdatePersonDto) {
    return await this.personService.updatePerson(+id, data);
  }
}
