import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminOrDelegateGuard } from 'src/auth/guards/adminOrDelegate.guard';
import { PersonService } from './person.service';

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
}
