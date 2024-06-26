import { DbService } from '../db/db.service';
import { HttpException, Injectable } from '@nestjs/common';
import { UpdatePersonDto } from './dto/updatePerson.dto';
import { AddStaffMemberDto } from './dto/addStaffMember.dto';
import { convertToLatin, getTranslation } from '../translations';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

@Injectable()
export class PersonService {
  constructor(private readonly prisma: DbService) {}

  async getPersons(
    page: number,
    pageSize: number,
    search?: string,
    registrantId?: number,
    withoutCardAssigned?: boolean,
    cardId?: string,
    onlyNewcomers?: boolean,
  ) {
    const whereParams = {};
    const searchParams = {
      OR: [
        {
          name: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          wcaId: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ],
    };
    if (registrantId) {
      whereParams['registrantId'] = registrantId;
    }
    if (cardId) {
      whereParams['cardId'] = cardId;
    }
    if (withoutCardAssigned && search) {
      whereParams['AND'] = [
        {
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
        searchParams,
      ];
    } else if (!withoutCardAssigned && search) {
      if (onlyNewcomers) {
        whereParams['AND'] = [
          searchParams,
          {
            wcaId: {
              equals: null,
            },
          },
        ];
      } else {
        whereParams['OR'] = searchParams.OR;
      }
    } else {
      if (onlyNewcomers) {
        whereParams['AND'] = [
          {
            wcaId: {
              equals: null,
            },
          },
          {
            canCompete: {
              equals: true,
            },
          },
        ];
      }
    }

    const persons = await this.prisma.person.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      where: whereParams,
      orderBy: {
        registrantId: 'asc',
      },
    });
    const totalPersons = await this.prisma.person.count({
      where: whereParams,
    });
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
    return this.prisma.person.findMany();
  }

  async checkIn(personId: string) {
    await this.prisma.person.update({
      where: { id: personId },
      data: {
        checkedInAt: new Date(),
      },
    });
    const checkedInPersonsCount = await this.prisma.person.count({
      where: {
        checkedInAt: {
          not: null,
        },
      },
    });
    const totalPersonsCount = await this.prisma.person.count();
    return {
      message: 'Checked in successfully',
      checkedInPersonsCount,
      totalPersonsCount,
    };
  }

  async checkedInCount() {
    const checkedInPersonsCount = await this.prisma.person.count({
      where: {
        checkedInAt: {
          not: null,
        },
      },
    });
    const totalPersonsCount = await this.prisma.person.count();
    const personsWhoDidNotCheckIn = await this.prisma.person.findMany({
      where: {
        checkedInAt: {
          equals: null,
        },
      },
      select: {
        id: true,
        name: true,
        registrantId: true,
        wcaId: true,
        cardId: true,
        canCompete: true,
        countryIso2: true,
        birthdate: true,
      },
    });
    return {
      checkedInPersonsCount,
      totalPersonsCount,
      personsWhoDidNotCheckIn,
    };
  }

  async getPersonsWithoutCardAssigned() {
    const count = await this.prisma.person.count({
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
      count,
    };
  }

  async updatePerson(id: string, data: UpdatePersonDto) {
    try {
      await this.prisma.person.update({
        where: { id },
        data: {
          cardId: data.cardId.toString(),
        },
      });
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError) {
        if (e.code === 'P2002') {
          throw new HttpException(
            {
              message: 'Card already assigned',
            },
            409,
          );
        }
      }
    }
    return {
      message: 'Person updated',
    };
  }

  async getPersonById(id: string) {
    return this.prisma.person.findFirst({
      where: {
        id,
      },
      select: {
        id: true,
        registrantId: true,
        wcaId: true,
        name: true,
        countryIso2: true,
        gender: true,
        canCompete: true,
      },
    });
  }

  async getPersonByCardId(cardId: string) {
    return this.prisma.person.findFirst({
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
        canCompete: true,
      },
    });
  }

  async getPersonInfo(cardId: string) {
    const person = await this.getPersonByCardId(cardId);
    if (!person) {
      return {
        message: getTranslation('competitorNotFound', 'en'),
        shouldResetTime: false,
        status: 404,
        error: true,
      };
    }
    return {
      ...person,
      name: convertToLatin(person.name),
    };
  }

  async addStaffMember(data: AddStaffMemberDto) {
    return this.prisma.person.create({
      data: {
        name: data.name,
        gender: data.gender,
        canCompete: false,
      },
    });
  }

  async getPersonInfoWithSensitiveData(cardId: string) {
    const person = await this.prisma.person.findFirst({
      where: {
        cardId,
      },
      select: {
        id: true,
        registrantId: true,
        wcaId: true,
        canCompete: true,
        name: true,
        countryIso2: true,
        birthdate: true,
        checkedInAt: true,
      },
    });
    if (!person) {
      throw new HttpException(
        {
          message: 'Competitor not found',
          shouldResetTime: false,
        },
        404,
      );
    }
    return person;
  }
}
