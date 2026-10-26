import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import {
  Prisma,
  PrismaClient,
  Role,
  SendingResultsFrequency,
} from '@prisma/client';
import { Activity, Assignment, Competition, Person } from '@wca/helpers';
import { sha512 } from 'js-sha512';

import { wcifRoleToAttendanceRole } from '../../src/wcif-helpers';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

//This is temporary fix for the issue with importing functions from the wcif-helpers library
const getGroupInfoByActivityId = (activityId: number, wcif: Competition) => {
  let groupInfo: Activity | null = null;
  wcif.schedule.venues.forEach((venue) => {
    venue.rooms.forEach((room) => {
      room.activities.forEach((activity) => {
        if (activity.id === activityId) {
          groupInfo = activity;
        }
        activity.childActivities.forEach((childActivity) => {
          if (childActivity.id === activityId) {
            groupInfo = childActivity;
          }
        });
      });
    });
  });
  return groupInfo as Activity | null;
};

/** What the dummy WCA says about the competition it generates */
interface GeneratedCompetition {
  id: string;
  countryIso2: string;
  startDate: string;
  accounts: { delegate: { token: string } };
}

const fetchFromWca = async <T>(path: string, token?: string): Promise<T> => {
  const url = `${process.env.WCA_ORIGIN}${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch (error) {
    throw new Error(
      `Could not reach the dummy WCA at ${url}; is it running and WCA_ORIGIN set? (${error})`,
    );
  }
  if (!response.ok) {
    throw new Error(`The dummy WCA answered ${response.status} for ${url}`);
  }
  return (await response.json()) as T;
};

/**
 * Seed the competition the dummy WCA generates, the way an import from the
 * WCA would. It starts on the day the dummy WCA started (pin it with
 * GENERATED_START_DATE there), so a fresh test stack shows a competition in
 * progress, and WCA sign-in and sync see the same competition.
 */
export async function seedDb() {
  const generated =
    await fetchFromWca<GeneratedCompetition>('/dummy/generated');
  const wcifPath = `/api/v0/competitions/${generated.id}/wcif/version/2`;
  const wcifPublic = await fetchFromWca<Competition>(wcifPath);
  // The private WCIF has registration status and birthdates
  const wcif = await fetchFromWca<Competition>(
    wcifPath,
    generated.accounts.delegate.token,
  );

  const adminPassword = sha512('admin');
  await prisma.user.deleteMany();
  await prisma.competition.deleteMany();
  await prisma.person.deleteMany();
  await prisma.room.deleteMany();
  await prisma.staffActivity.deleteMany();
  await prisma.unofficialEvent.deleteMany();
  await prisma.user.create({
    data: {
      username: 'admin',
      fullName: 'Admin',
      roles: [Role.ADMIN],
      password: adminPassword,
    },
  });
  await prisma.competition.create({
    data: {
      name: wcifPublic.name,
      sendingResultsFrequency: SendingResultsFrequency.AFTER_SOLVE,
      wcaId: wcifPublic.id,
      countryIso2: generated.countryIso2,
      shouldUpdateDevices: true,
      wifiSsid: 'FKM',
      wifiPassword: 'FKM',
      scoretakingToken: 'wca-live-token',
      scoretakingTokenUpdatedAt: new Date(),
      wcif: wcifPublic as unknown as Prisma.InputJsonValue,
      fkmToken: 69420,
    },
  });
  await prisma.person.createMany({
    data: wcif.persons
      .filter(
        (person: Person) =>
          person.registrantId && person.registration?.status === 'accepted',
      )
      .map((person: Person) => ({
        wcaId: person.wcaId,
        name: person.name,
        registrantId: person.registrantId,
        gender: person.gender,
        countryIso2: person.countryIso2,
        canCompete: person.registration.isCompeting,
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
  const personIds = new Map(
    (await prisma.person.findMany()).map((p) => [p.registrantId, p.id]),
  );
  const staffActivities = [];
  wcifPublic.persons
    .filter((person: Person) => personIds.has(person.registrantId))
    .forEach((person: Person) => {
      person.assignments.forEach((assignment: Assignment) => {
        const group = getGroupInfoByActivityId(
          assignment.activityId,
          wcifPublic,
        );
        staffActivities.push({
          personId: personIds.get(person.registrantId),
          role: wcifRoleToAttendanceRole(assignment.assignmentCode),
          groupId: group.activityCode,
          isAssigned: true,
        });
      });
    });
  await prisma.staffActivity.createMany({ data: staffActivities });
  await prisma.room.createMany({
    data: rooms,
  });
  console.log(
    `Test database seeded with ${wcifPublic.id}, starting on ${generated.startDate}`,
  );
}
// Seed when run as a script; importing seedDb runs nothing
if (require.main === module) {
  seedDb()
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      console.error(e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
