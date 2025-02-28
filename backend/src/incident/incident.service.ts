import { HttpException, Injectable } from '@nestjs/common';
import { AttemptStatus } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { activityCodeToName } from '@wca/helpers';
import { publicPersonSelect } from 'src/constants';
import { DbService } from 'src/db/db.service';

import { NoteworthyIncidentDto } from './dto/noteworthyIncident.dto';
import { WarningDto } from './dto/warning.dto';

@Injectable()
export class IncidentService {
  constructor(private readonly prisma: DbService) {}

  async addAttemptAsNoteworthyIncident(attemptId: string, userId: string) {
    const attempt = await this.prisma.attempt.findUnique({
      where: { id: attemptId },
      include: {
        result: {
          include: {
            person: true,
          },
        },
      },
    });

    if (!attempt) {
      throw new HttpException('Attempt not found', 404);
    }

    const title = `${attempt.result.person.name} - ${activityCodeToName(attempt.result.roundId)}`;

    try {
      await this.prisma.noteworthyIncident.create({
        data: {
          attempt: { connect: { id: attemptId } },
          title,
          description: attempt.comment,
          createdBy: { connect: { id: userId } },
        },
      });
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError) {
        if (e.code === 'P2002') {
          throw new HttpException(
            {
              message: 'This attempt is already marked as noteworthy',
            },
            409,
          );
        }
      }
    }
  }

  async getUnresolvedIncidents() {
    return this.prisma.attempt.findMany({
      where: { status: AttemptStatus.UNRESOLVED },
      include: {
        judge: publicPersonSelect,
        device: true,
        result: {
          include: {
            person: publicPersonSelect,
          },
        },
      },
    });
  }

  async getResolvedIncidents(search?: string) {
    const whereParams = {};
    if (search) {
      whereParams['result'] = {
        person: {
          name: {
            contains: search,
            mode: 'insensitive',
          },
        },
      };
    }
    return this.prisma.attempt.findMany({
      where: {
        ...whereParams,
        status: {
          in: [AttemptStatus.RESOLVED, AttemptStatus.EXTRA_GIVEN],
        },
      },
      orderBy: {
        solvedAt: 'desc',
      },
      include: {
        judge: publicPersonSelect,
        updatedBy: {
          select: {
            id: true,
            fullName: true,
          },
        },
        device: true,
        result: {
          include: {
            person: publicPersonSelect,
          },
        },
      },
    });
  }

  async getNoteworthyIncidents(search?: string) {
    const whereParams = {};
    if (search) {
      whereParams['OR'] = [
        {
          title: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          description: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }
    return this.prisma.noteworthyIncident.findMany({
      where: whereParams,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        attempt: {
          include: {
            result: {
              include: {
                person: publicPersonSelect,
              },
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });
  }

  async getUnresolvedIncidentsCount() {
    const count = await this.prisma.attempt.count({
      where: { status: AttemptStatus.UNRESOLVED },
    });
    return {
      count,
    };
  }

  async createNoteworthyIncident(data: NoteworthyIncidentDto, userId: string) {
    return this.prisma.noteworthyIncident.create({
      data: {
        title: data.title,
        description: data.description,
        createdBy: { connect: { id: userId } },
      },
    });
  }

  async updateNoteworthyIncident(id: string, data: NoteworthyIncidentDto) {
    return this.prisma.noteworthyIncident.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
      },
    });
  }

  async deleteNoteworthyIncident(id: string) {
    await this.prisma.noteworthyIncident.delete({
      where: { id },
    });
  }

  async getAllWarnings(search?: string) {
    const whereParams = {};
    if (search) {
      whereParams['OR'] = [
        {
          description: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }
    return this.prisma.warning.findMany({
      where: whereParams,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        person: publicPersonSelect,
        createdBy: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });
  }

  async getWarningsForPerson(personId: string) {
    return this.prisma.warning.findMany({
      where: { personId },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        createdBy: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });
  }

  async issueWarning(personId: string, data: WarningDto, userId: string) {
    return this.prisma.warning.create({
      data: {
        description: data.description,
        person: { connect: { id: personId } },
        createdBy: { connect: { id: userId } },
      },
    });
  }

  async deleteWarning(id: string) {
    await this.prisma.warning.delete({
      where: { id },
    });
  }
}
