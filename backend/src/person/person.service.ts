import { DbService } from './../db/db.service';
import { Injectable } from '@nestjs/common';
import { UpdatePersonDto } from './dto/updatePerson.dto';
import { AssignManyCardsDto } from './dto/assignManyCards.dto';

@Injectable()
export class PersonService {
  constructor(private readonly prisma: DbService) {}

  async getPersons(page: number, pageSize: number, search?: string) {
    const whereParams = {};
    if (search) {
      whereParams['OR'] = [
        {
          name: {
            contains: search,
          },
        },
        {
          wcaId: {
            contains: search,
          },
        },
        {
          cardId: {
            equals: search,
          },
        },
      ];
      if (!isNaN(parseInt(search))) {
        whereParams['OR'].push({
          registrantId: parseInt(search),
        });
      }
    }
    const persons = await this.prisma.person.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      where: whereParams,
    });
    const totalPersons = await this.prisma.person.count();
    const personsWithoutCardAssigned = await this.prisma.person.count({
      where: {
        OR: [
          {
            cardId: {
              equals: null,
            },
          },
          {
            cardId: {
              equals: '',
            },
          },
          {
            cardId: {
              equals: '0',
            },
          },
        ],
      },
    });
    return {
      data: persons,
      count: totalPersons,
      personsWithoutCardAssigned,
    };
  }

  async getAllPersons() {
    return await this.prisma.person.findMany();
  }

  async getPersonsWithoutCardAssigned() {
    return await this.prisma.person.findMany({
      where: {
        OR: [
          {
            cardId: {
              equals: null,
            },
          },
          {
            cardId: {
              equals: '',
            },
          },
          {
            cardId: {
              equals: '0',
            },
          },
        ],
      },
    });
  }

  async assignManyCards(data: AssignManyCardsDto) {
    const transactions = data.persons.map((person) => {
      return this.prisma.person.update({
        where: { id: person.id },
        data: {
          cardId: person.cardId.toString(),
        },
      });
    });
    return await this.prisma.$transaction(transactions);
  }

  async updatePerson(id: number, data: UpdatePersonDto) {
    return await this.prisma.person.update({
      where: { id },
      data: {
        cardId: data.cardId.toString(),
      },
    });
  }

  async getPersonInfo(cardId: string) {
    return await this.prisma.person.findFirst({
      where: {
        cardId,
      },
      select: {
        id: true,
        registrantId: true,
        wcaId: true,
        name: true,
        countryIso2: true,
        gender: true,
      },
    });
  }
}
