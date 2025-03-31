import { HttpException, Injectable } from '@nestjs/common';
import { StaffRole } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { Activity, Assignment, Competition } from '@wca/helpers';
import { WcaService } from 'src/wca/wca.service';
import { getActivityInfoFromSchedule, getPersonFromWcif } from 'wcif-helpers';

import { DbService } from '../db/db.service';
import { AddPersonDto } from './dto/addPerson.dto';
import { ChangeCompetingGroupDto } from './dto/changeCompetingGroup.dto';
import { UpdatePersonDto } from './dto/updatePerson.dto';

@Injectable()
export class PersonService {
  constructor(
    private readonly prisma: DbService,
    private readonly wcaService: WcaService,
  ) {}

  async getPersons(
    page: number,
    pageSize: number,
    search?: string,
    registrantId?: number,
    withoutCardAssigned?: boolean,
    cardId?: string,
    onlyNewcomers?: boolean,
    onlyNotCheckedIn?: boolean,
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
      if (onlyNotCheckedIn) {
        whereParams['checkedInAt'] = {
          equals: null,
        };
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

  async getAllPersons(withoutCardAssigned?: boolean, search?: string) {
    const whereParams = {};
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
        {
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
        },
      ];
    } else if (!withoutCardAssigned && search) {
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
      ];
    } else if (withoutCardAssigned && !search) {
      whereParams['OR'] = [
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
      ];
    }

    return this.prisma.person.findMany({
      where: whereParams,
      orderBy: {
        registrantId: 'asc',
      },
    });
  }

  async checkIn(personId: string, data: UpdatePersonDto) {
    try {
      await this.prisma.person.update({
        where: { id: personId },
        data: {
          checkedInAt: new Date(),
          cardId: data.cardId,
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
    const cardId = data.cardId.toString() || null;
    try {
      await this.prisma.person.update({
        where: { id },
        data: {
          cardId,
        },
      });
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError) {
        if (e.code === 'P2002') {
          throw new HttpException(
            {
              message: 'This card is already assigned to someone else',
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
        cardId: cardId.toString(),
      },
      select: {
        id: true,
        registrantId: true,
        wcaId: true,
        cardId: true,
        name: true,
        countryIso2: true,
        gender: true,
        canCompete: true,
      },
    });
  }

  async addPerson(data: AddPersonDto) {
    if (data.canCompete && !data.countryIso2) {
      throw new HttpException(
        {
          message: 'Country is required',
        },
        400,
      );
    }
    return this.prisma.person.create({
      data: {
        name: data.name,
        wcaId: data.wcaId,
        countryIso2: data.countryIso2,
        cardId: data.cardId || null,
        canCompete: data.canCompete,
        gender: data.gender,
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
        cardId: true,
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

  async changeCompetingGroup(userId: string, data: ChangeCompetingGroupDto) {
    const roundId = data.newGroupId.split('-g')[0];
    const currentGroup = await this.prisma.staffActivity.findFirst({
      where: {
        groupId: {
          contains: roundId,
        },
        personId: data.personId,
        role: StaffRole.COMPETITOR,
      },
      include: {
        person: true,
      },
    });
    const overlappingAssignments = await this.prisma.staffActivity.findMany({
      where: {
        groupId: data.newGroupId,
        personId: data.personId,
      },
    });
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });
    if (!user.wcaUserId) {
      throw new HttpException('You are not allowed to access WCIF', 403);
    }
    const competition = await this.prisma.competition.findFirst();
    const wcif: Competition = await this.wcaService.getWcif(
      competition.wcaId,
      user.wcaAccessToken,
    );
    const personInfo = getPersonFromWcif(
      currentGroup.person.registrantId,
      wcif,
    );
    const currentActivity: Activity = getActivityInfoFromSchedule(
      currentGroup.groupId,
      wcif,
    );
    const newActivity: Activity = getActivityInfoFromSchedule(
      data.newGroupId,
      wcif,
    );
    const overlappingAssignmentsActivityIds: number[] = [];
    overlappingAssignments.map((oa) => {
      const activity: Activity = getActivityInfoFromSchedule(oa.groupId, wcif);
      if (activity) {
        overlappingAssignmentsActivityIds.push(activity.id);
      }
    });
    if (currentActivity && newActivity) {
      const filteredAssignments = personInfo.assignments.filter(
        (a: Assignment) =>
          a.activityId !== currentActivity.id &&
          !overlappingAssignmentsActivityIds.some((oa) => oa === a.activityId),
      );
      const newAssignments = [
        ...filteredAssignments,
        {
          activityId: newActivity.id,
          stationNumber: null,
          assignmentCode: 'competitor',
        },
      ];
      const newPerson = {
        ...personInfo,
        assignments: newAssignments,
      };
      const newPersons = wcif.persons.filter(
        (p) => p.registrantId !== newPerson.registrantId,
      );
      newPersons.push(newPerson);
      const newWcif = {
        persons: newPersons,
      };
      const response = await this.wcaService.patchWcif(
        competition.wcaId,
        newWcif,
        user.wcaAccessToken,
      );
      if (response.statusCode === 200) {
        await this.prisma.staffActivity.deleteMany({
          where: {
            personId: currentGroup.personId,
            groupId: data.newGroupId,
          },
        });
        await this.prisma.staffActivity.update({
          where: {
            id: currentGroup.id,
          },
          data: {
            groupId: data.newGroupId,
          },
        });
        return {
          message: 'Successfully moved the competitor to another group',
        };
      } else {
        throw new HttpException(response.message, response.statusCode || 500);
      }
    }
  }
}
