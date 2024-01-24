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

@Controller('person')
export class PersonController {
  constructor(private readonly personService: PersonService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get()
  async getAllPersons(
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 10,
    @Query('search') search?: string,
  ) {
    return await this.personService.getAllPersons(+page, +pageSize, search);
  }

  @Get('card/:cardId')
  async getPersonInfo(@Param('cardId') cardId: string) {
    return await this.personService.getPersonInfo(cardId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Put(':id')
  async updatePerson(@Param('id') id: number, @Body() data: UpdatePersonDto) {
    return await this.personService.updatePerson(+id, data);
  }
}
