import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminOrDelegateGuard } from 'src/auth/guards/adminOrDelegate.guard';
import { PersonService } from './person.service';
import { UpdatePersonDto } from './dto/updatePerson.dto';

@UseGuards(AdminOrDelegateGuard)
@Controller('person')
export class PersonController {
  constructor(private readonly personService: PersonService) {}

  @Get()
  async getAllPersons(
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 10,
  ) {
    return await this.personService.getAllPersons(+page, +pageSize);
  }

  @Put(':id')
  async updatePerson(@Param('id') id: number, @Body() data: UpdatePersonDto) {
    return await this.personService.updatePerson(+id, data);
  }
}
