import { forwardRef, HttpException, Inject } from '@nestjs/common';
import { Role, SendingResultsFrequency } from '@prisma/client';
import { Assignment, Person } from '@wca/helpers';
import { ADMIN_WCA_USER_IDS } from 'src/constants';
import { DbService } from 'src/db/db.service';
import { WcaService } from 'src/wca/wca.service';
import { wcifRoleToAttendanceRole } from 'src/wcif-helpers';
import { getGroupInfoByActivityId } from 'wcif-helpers';

export class ImportService {
  constructor(
    @Inject(forwardRef(() => DbService))
    private readonly prisma: DbService,
    private readonly wcaService: WcaService,
  ) {}

  async importCompetition(wcaId: string, userId: string) {
    const existingCompetition = await this.prisma.competition.findFirst();
    if (existingCompetition) {
      throw new HttpException('Competition already exists', 400);
    }
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
      },
    });
    await this.prisma.user.deleteMany({
      where: {
        id: {
          not: userId,
        },
      },
    });
    const wcifPublic = await this.wcaService.getPublicWcif(wcaId);
    const wcif = await this.wcaService.getWcif(wcaId, user.wcaAccessToken);
    const competitionInfo = await this.wcaService.getCompetitionInfo(wcaId);
    if (user.wcaAccessToken) {
      if (ADMIN_WCA_USER_IDS.includes(user.wcaUserId)) {
        await this.prisma.user.update({
          where: {
            id: user.id,
          },
          data: {
            roles: [...user.roles, 'ADMIN'],
          },
        });
      } else {
        const isDelegate = competitionInfo.delegates.some(
          (delegate) => delegate.id === user.wcaUserId,
        );
        const isOrganizer = competitionInfo.organizers.some(
          (organizer) => organizer.id === user.wcaUserId,
        );
        const roles = [];
        if (isDelegate) {
          roles.push(Role.DELEGATE);
        }
        if (isOrganizer) {
          roles.push(Role.ORGANIZER);
        }
        if (roles.length === 0) {
          throw new HttpException(
            'You are not allowed to import this competition',
            403,
          );
        }
        await this.prisma.user.update({
          where: {
            id: user.id,
          },
          data: {
            roles,
          },
        });
      }
    }
    const competition = await this.prisma.competition.create({
      data: {
        name: wcifPublic.name,
        wcaId: wcifPublic.id,
        countryIso2: wcifPublic.countryIso2,
        wcif: wcifPublic,
        sendingResultsFrequency: SendingResultsFrequency.AFTER_SOLVE,
      },
    });
    await this.prisma.person.createMany({
      data: wcif.persons
        .filter(
          (p: Person) => p.registrantId && p.registration.status === 'accepted',
        )
        .map((person: Person) => ({
          wcaId: person.wcaId,
          name: person.name,
          registrantId: person.registrantId,
          gender: person.gender,
          countryIso2: person.countryIso2,
          canCompete: person.registration && person.registration.isCompeting,
          birthdate: person.wcaId
            ? null
            : person.birthdate && new Date(person.birthdate),
        })),
    });
    const rooms = [];

    for (const venue of wcifPublic.schedule.venues) {
      for (const room of venue.rooms) {
        rooms.push({
          name: room.name,
          color: room.color,
        });
      }
    }
    const staffActivitiesTransactions = [];

    wcifPublic.persons.forEach((person: Person) => {
      person.assignments.forEach((assignment: Assignment) => {
        const group = getGroupInfoByActivityId(
          assignment.activityId,
          wcifPublic,
        );
        staffActivitiesTransactions.push(
          this.prisma.staffActivity.create({
            data: {
              person: {
                connect: {
                  registrantId: person.registrantId,
                },
              },
              role: wcifRoleToAttendanceRole(assignment.assignmentCode),
              groupId: group.activityCode,
              isAssigned: true,
            },
          }),
        );
      });
    });
    await this.prisma.$transaction(staffActivitiesTransactions);
    await this.prisma.room.createMany({
      data: rooms,
    });
    return competition;
  }
}
