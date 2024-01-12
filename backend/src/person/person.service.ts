import { DbService } from './../db/db.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class PersonService {
  constructor(private readonly prisma: DbService) {}

  async getAllPersons(page: number, pageSize: number) {
    const persons = await this.prisma.person.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    const totalPersons = await this.prisma.person.count();
    return {
      data: persons,
      count: totalPersons,
    };
  }
}
