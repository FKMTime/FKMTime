import { forwardRef, HttpException, Inject } from '@nestjs/common';
import { StaffRole } from '@prisma/client';
import { DbService } from 'src/db/db.service';
import { isUnofficialEvent } from 'src/events';
import { assertWcaCompetitionFound, WcaService } from 'src/wca/wca.service';
import { wcifRoleToAttendanceRole } from 'src/wcif-helpers';
import { Assignment, Person } from 'wcif-helpers';
import { getGroupInfoByActivityId } from 'wcif-helpers';

type PersonSyncData = {
  registrantId: number;
  name: string;
  wcaId: string | null;
  gender: string;
  countryIso2: string;
  birthdate?: Date | null;
};

/** Whether syncing would change anything; undefined fields are left alone */
const hasPersonChanged = (
  existing: Record<string, unknown>,
  incoming: PersonSyncData,
) =>
  Object.entries(incoming).some(([key, value]) => {
    if (value === undefined) return false;
    const current = existing[key];
    if (value instanceof Date || current instanceof Date) {
      return (
        (value as Date | null)?.getTime() !==
        (current as Date | null)?.getTime()
      );
    }
    return (current ?? null) !== (value ?? null);
  });

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
    const wcifPublic = await this.wcaService.getWcif(wcaId, undefined, true);
    assertWcaCompetitionFound(wcifPublic.statusCode);
    // The private WCIF has birthdates and registration status, the public one
    // only the basics
    let personsData: PersonSyncData[];
    let removedRegistrantIds: number[] = [];
    if (user.wcaUserId) {
      const wcif = await this.wcaService.getWcif(wcaId, user.wcaAccessToken);
      if (wcif.statusCode === 403) {
        throw new HttpException("You don't have access to that WCIF", 403);
      } else if (wcif.statusCode === 401) {
        throw new HttpException('WCA token expired. Please log in again.', 401);
      }
      personsData = wcif.persons
        .filter(
          (person: Person) =>
            person.registrantId && person.registration.status === 'accepted',
        )
        .map((person: Person) => ({
          registrantId: person.registrantId,
          name: person.name,
          wcaId: person.wcaId,
          gender: person.gender,
          countryIso2: person.countryIso2,
          birthdate: person.wcaId
            ? null
            : person.birthdate && new Date(person.birthdate),
        }));
      // Registrations that were never accepted have no registrant id and so
      // were never imported
      removedRegistrantIds = wcif.persons
        .filter(
          (person: Person) =>
            person.registrantId &&
            person.registration &&
            person.registration.status !== 'accepted',
        )
        .map((person: Person) => person.registrantId);
    } else {
      personsData = wcifPublic.persons
        .filter((person: Person) => person.registrantId)
        .map((person: Person) => ({
          registrantId: person.registrantId,
          name: person.name,
          wcaId: person.wcaId,
          gender: person.gender,
          countryIso2: person.countryIso2,
        }));
    }

    const currentRooms = await this.prisma.room.findMany();
    const rooms = [];

    for (const venue of wcifPublic.schedule.venues) {
      for (const room of venue.rooms) {
        if (!currentRooms.some((r) => r.name === room.name)) {
          rooms.push({
            name: room.name,
            color: room.color,
          });
        }
      }
    }

    await this.prisma.room.createMany({
      data: rooms,
      skipDuplicates: true,
    });

    // Persons first: assignments below need every new person's id. Only new
    // and changed persons are written, so a sync of a large competition stays
    // a handful of queries instead of one per competitor.
    const existingPersons = new Map(
      (await this.prisma.person.findMany()).map((person) => [
        person.registrantId,
        person,
      ]),
    );
    const personsToCreate = personsData.filter(
      (person) => !existingPersons.has(person.registrantId),
    );
    const personsToUpdate = personsData.filter((person) => {
      const existing = existingPersons.get(person.registrantId);
      return existing && hasPersonChanged(existing, person);
    });
    await this.prisma.$transaction(
      async (tx) => {
        await tx.person.createMany({
          data: personsToCreate,
          skipDuplicates: true,
        });
        for (const { registrantId, ...data } of personsToUpdate) {
          await tx.person.update({ where: { registrantId }, data });
        }
        if (removedRegistrantIds.length > 0) {
          await tx.person.deleteMany({
            where: { registrantId: { in: removedRegistrantIds } },
          });
        }
      },
      { timeout: 60_000 },
    );

    const personIdByRegistrantId = new Map(
      (
        await this.prisma.person.findMany({
          select: { id: true, registrantId: true },
        })
      ).map((person) => [person.registrantId, person.id]),
    );
    const assignments: {
      personId: string;
      groupId: string;
      role: StaffRole;
    }[] = [];
    wcifPublic.persons.forEach((person: Person) => {
      const personId = personIdByRegistrantId.get(person.registrantId);
      // Not accepted, so not imported
      if (!personId) return;
      person.assignments.forEach((assignment: Assignment) => {
        const group = getGroupInfoByActivityId(
          assignment.activityId,
          wcifPublic,
        );
        assignments.push({
          personId,
          groupId: group.activityCode,
          role: wcifRoleToAttendanceRole(
            assignment.assignmentCode,
          ) as StaffRole,
        });
      });
    });
    const activityKey = (a: {
      personId: string;
      groupId: string;
      role: string;
    }) => `${a.personId}|${a.groupId}|${a.role}`;
    const existingActivities = new Map(
      (
        await this.prisma.staffActivity.findMany({
          where: {
            personId: { in: [...new Set(assignments.map((a) => a.personId))] },
          },
          select: {
            id: true,
            personId: true,
            groupId: true,
            role: true,
            isAssigned: true,
          },
        })
      ).map((activity) => [activityKey(activity), activity]),
    );
    const activitiesToCreate = assignments
      .filter((assignment) => !existingActivities.has(activityKey(assignment)))
      .map((assignment) => ({ ...assignment, isAssigned: true }));
    const activityIdsToAssign = assignments
      .map((assignment) => existingActivities.get(activityKey(assignment)))
      .filter((activity) => activity && !activity.isAssigned)
      .map((activity) => activity.id);
    await this.prisma.$transaction([
      this.prisma.staffActivity.createMany({
        data: activitiesToCreate,
        skipDuplicates: true,
      }),
      this.prisma.staffActivity.updateMany({
        where: { id: { in: activityIdsToAssign } },
        data: { isAssigned: true },
      }),
    ]);
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
    const wcifPublic = JSON.parse(JSON.stringify(competition.wcif));
    wcifPublic.events = wcifPublic.events.filter(
      (event) => !isUnofficialEvent(event.id),
    );
    unofficialEvents
      .filter((event) => isUnofficialEvent(event.eventId))
      .forEach((event) => {
        wcifPublic.events.push(event.wcif);
      });
    await this.prisma.competition.update({
      where: { id: competition.id },
      data: { wcif: wcifPublic },
    });
  }
}
