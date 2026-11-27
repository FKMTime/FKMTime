import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import { sha512 } from 'js-sha512';
import { Activity, Assignment, Competition, Person } from 'wcif-helpers';

import {
  Prisma,
  PrismaClient,
  Role,
  SendingResultsFrequency,
} from '../../src/generated/prisma/client';
import { BRACKET_SIZES, getStages } from '../../src/h2h/bracket';
import { createBracket } from '../../src/h2h/bracketStore';
import { whyNoBracket } from '../../src/h2h/h2hRound';
import {
  seedFromPreviousRound,
  suggestBracketSize,
} from '../../src/h2h/seeding';
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
  // Points keep their attempts from being deleted with their people
  await prisma.h2hBracket.deleteMany();
  // Stations from earlier testing stay unless removed: attendance and
  // attempts (deleted with their people) point at them, and they point at
  // rooms, all without a cascade
  await prisma.user.deleteMany();
  await prisma.competition.deleteMany();
  await prisma.staffActivity.deleteMany();
  await prisma.person.deleteMany();
  await prisma.device.deleteMany();
  await prisma.scramblingDevice.deleteMany();
  await prisma.room.deleteMany();
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
    data: wcif.persons.flatMap((person: Person) => {
      const { registration } = person;
      if (!person.registrantId || registration?.status !== 'accepted') {
        return [];
      }
      return [
        {
          wcaId: person.wcaId,
          name: person.name,
          registrantId: person.registrantId,
          // As the import keeps it: the WCA CSV export needs it
          wcaRegistrationId: registration.wcaRegistrationId ?? null,
          gender: person.gender,
          countryIso2: person.countryIso2,
          canCompete: registration.isCompeting,
          birthdate: person.wcaId
            ? null
            : person.birthdate && new Date(person.birthdate),
        },
      ];
    }),
  });
  const rooms: Prisma.RoomCreateManyInput[] = [];

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
  const staffActivities: Prisma.StaffActivityCreateManyInput[] = [];
  wcifPublic.persons.forEach((person: Person) => {
    const personId = personIds.get(person.registrantId);
    if (!personId) return;
    person.assignments.forEach((assignment: Assignment) => {
      const group = getGroupInfoByActivityId(assignment.activityId, wcifPublic);
      if (!group) {
        throw new Error(
          `Activity ${assignment.activityId} is not in the WCIF schedule`,
        );
      }
      staffActivities.push({
        personId,
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
  await seedH2hBracket(wcif);
  console.log(
    `Test database seeded with ${wcifPublic.id}, starting on ${generated.startDate}`,
  );
}
/**
 * A bracket for the WCIF's head-to-head round, if it has one, so local and
 * e2e environments have one. Seeds come from the previous round's ranking;
 * without one (a fresh dummy competition has no results), the event's
 * accepted registrants in registrant id order.
 */
export async function seedH2hBracket(wcif: Competition) {
  const round = wcif.events
    .flatMap((event) => event.rounds)
    .find((r) => r.format === 'h' && whyNoBracket(r.id, wcif) === null);
  if (!round) return;
  const eventId = round.id.split('-r')[0];
  const registrantIds = wcif.persons
    .filter(
      (person) =>
        person.registration?.status === 'accepted' &&
        person.registration.eventIds.includes(eventId as never),
    )
    .map((person) => person.registrantId)
    .sort((x, y) => x - y);
  const size =
    suggestBracketSize(round.id, wcif) ??
    [...BRACKET_SIZES].reverse().find((s) => s <= registrantIds.length);
  if (size === undefined) return;
  const fromRanking = seedFromPreviousRound(round.id, wcif, size).seeds;
  const seeds =
    fromRanking.length > 0
      ? fromRanking
      : registrantIds
          .slice(0, size)
          .map((registrantId) => ({ registrantId, tieBroken: false }));
  const persons = await prisma.person.findMany({
    where: { registrantId: { in: seeds.map((seed) => seed.registrantId) } },
  });
  await prisma.$transaction((db) =>
    createBracket(db, {
      roundId: round.id,
      eventId,
      size,
      setsToWin: Object.fromEntries(getStages(size).map((stage) => [stage, 1])),
      seeds: seeds.flatMap((seed) => {
        const person = persons.find(
          (p) => p.registrantId === seed.registrantId,
        );
        return person
          ? [{ personId: person.id, seedTieBroken: seed.tieBroken }]
          : [];
      }),
    }),
  );
  console.log(`Seeded a ${size}-competitor bracket for ${round.id}`);
}

/** Closes the seed's own connection (a test that imports seedDb must) */
export const disconnectSeedDb = () => prisma.$disconnect();

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
