import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PersonService } from './person.service';
import { UpdatePersonDto } from './dto/updatePerson.dto';
import { AuthGuard } from '@nestjs/passport';
import { AssignManyCardsDto } from './dto/assignManyCards.dto';
import { AdminOrDelegateGuard } from '../auth/guards/adminOrDelegate.guard';

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

  @UseGuards(AuthGuard('jwt'), AdminOrDelegateGuard)
  @Put(':id')
  async updatePerson(@Param('id') id: number, @Body() data: UpdatePersonDto) {
    return await this.personService.updatePerson(+id, data);
  }
}
