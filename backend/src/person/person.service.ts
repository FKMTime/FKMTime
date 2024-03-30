import { DbService } from '../db/db.service';
import { HttpException, Injectable } from '@nestjs/common';
import { UpdatePersonDto } from './dto/updatePerson.dto';
import { AddStaffMemberDto } from './dto/addStaffMember.dto';
import { convertPolishToLatin, getTranslation } from '../translations';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

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
            mode: 'insensitive',
          },
        },
        {
          wcaId: {
            contains: search,
            mode: 'insensitive',
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

  async collectGiftpack(personId: string) {
    await this.prisma.person.update({
      where: { id: personId },
      data: {
        giftpackCollectedAt: new Date(),
      },
    });
    const collectedGiftpacksCount = await this.prisma.person.count({
      where: {
        giftpackCollectedAt: {
          not: null,
        },
      },
    });
    const totalPersonsCount = await this.prisma.person.count();
    return {
      message: 'Giftpack collected',
      collectedGiftpacksCount,
      totalPersonsCount,
    };
  }

  async giftpackCount() {
    const collectedGiftpacksCount = await this.prisma.person.count({
      where: {
        giftpackCollectedAt: {
          not: null,
        },
      },
    });
    const totalPersonsCount = await this.prisma.person.count();
    const personsWithoutGiftpackCollected = await this.prisma.person.findMany({
      where: {
        giftpackCollectedAt: {
          equals: null,
        },
      },
      select: {
        id: true,
        name: true,
        registrantId: true,
        wcaId: true,
      },
    });
    return {
      collectedGiftpacksCount,
      totalPersonsCount,
      personsWithoutGiftpackCollected,
    };
  }

  async getPersonsWithoutCardAssigned() {
    return this.prisma.person.findMany({
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
      throw new HttpException(
        {
          message: getTranslation('competitorNotFound', 'en'),
          shouldResetTime: false,
        },
        404,
      );
    }
    return {
      ...person,
      name: convertPolishToLatin(person.name),
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
        name: true,
        countryIso2: true,
        birthdate: true,
        giftpackCollectedAt: true,
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
