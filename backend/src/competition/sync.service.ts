import { HttpException, Inject, forwardRef } from '@nestjs/common';
import { StaffRole } from '@prisma/client';
import { Assignment, Person } from '@wca/helpers';
import { DbService } from 'src/db/db.service';
import { WcaService } from 'src/wca/wca.service';
import { wcifRoleToAttendanceRole } from 'src/wcif-helpers';
import { getGroupInfoByActivityId } from 'wcif-helpers';

export class SyncService {
  constructor(
    @Inject(forwardRef(() => DbService))
    private readonly prisma: DbService,
    private readonly wcaService: WcaService,
  ) {}

  async updateWcif(wcaId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
      },
    });
    const wcifPublic = await this.wcaService.getPublicWcif(wcaId);
    const transactions = [];
    if (user.wcaUserId) {
      const wcif = await this.wcaService.getWcif(wcaId, user.wcaAccessToken);
      wcif.persons.forEach((person: Person) => {
        if (person.registrantId && person.registration.status === 'accepted') {
          transactions.push(
            this.prisma.person.upsert({
              where: {
                registrantId: person.registrantId,
              },
              update: {
                name: person.name,
                wcaId: person.wcaId,
                gender: person.gender,
                countryIso2: person.countryIso2,
                birthdate: person.wcaId
                  ? null
                  : person.birthdate && new Date(person.birthdate),
              },
              create: {
                name: person.name,
                wcaId: person.wcaId,
                registrantId: person.registrantId,
                gender: person.gender,
                countryIso2: person.countryIso2,
                birthdate: person.wcaId
                  ? null
                  : person.birthdate && new Date(person.birthdate),
              },
            }),
          );
        }
      });
      wcif.persons
        .filter((p) => p.registration.status !== 'accepted')
        .forEach((p) => {
          transactions.push(
            this.prisma.person.deleteMany({
              where: {
                registrantId: p.registrantId,
              },
            }),
          );
        });
    } else {
      wcifPublic.persons.forEach((person: Person) => {
        if (person.registrantId) {
          transactions.push(
            this.prisma.person.upsert({
              where: {
                registrantId: person.registrantId,
              },
              update: {
                name: person.name,
                wcaId: person.wcaId,
                gender: person.gender,
                countryIso2: person.countryIso2,
              },
              create: {
                name: person.name,
                wcaId: person.wcaId,
                registrantId: person.registrantId,
                gender: person.gender,
                countryIso2: person.countryIso2,
              },
            }),
          );
        }
      });
    }
    const activitiesTransactions = [];
    const persons = await this.prisma.person.findMany();
    wcifPublic.persons.forEach((person: Person) => {
      person.assignments.forEach((assignment: Assignment) => {
        const group = getGroupInfoByActivityId(
          assignment.activityId,
          wcifPublic,
        );
        const personData = persons.find(
          (p) => p.registrantId === person.registrantId,
        );
        activitiesTransactions.push(
          this.prisma.staffActivity.upsert({
            where: {
              personId_groupId_role: {
                groupId: group.activityCode,
                personId: personData.id,
                role: wcifRoleToAttendanceRole(assignment.assignmentCode),
              },
            },
            update: {
              isAssigned: true,
            },
            create: {
              person: {
                connect: {
                  registrantId: person.registrantId,
                },
              },
              role: wcifRoleToAttendanceRole(
                assignment.assignmentCode,
              ) as StaffRole,
              groupId: group.activityCode,
              isAssigned: true,
            },
          }),
        );
      });
    });
    await this.prisma.$transaction(transactions);
    await this.prisma.$transaction(activitiesTransactions);
    await this.prisma.competition.updateMany({
      where: { wcaId },
      data: {
        name: wcifPublic.name,
        countryIso2: wcifPublic.countryIso2,
        wcif: wcifPublic,
      },
    });
    await this.addUnofficialEventsToWcif();
  }

  async addUnofficialEventsToWcif() {
    const unofficialEvents = await this.prisma.unofficialEvent.findMany();
    const competition = await this.prisma.competition.findFirst();
    if (!competition) {
      throw new HttpException('Competition not found', 404);
    }
    const wcifPublic = await this.wcaService.getPublicWcif(competition.wcaId);
    unofficialEvents.forEach((event) => {
      wcifPublic.events.push(event.wcif);
    });
    await this.prisma.competition.update({
      where: { id: competition.id },
      data: { wcif: wcifPublic },
    });
  }
}
