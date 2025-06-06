import { PrismaClient, Role, SendingResultsFrequency } from '@prisma/client';
import { Activity, Assignment, Competition, Person } from '@wca/helpers';
import * as fs from 'fs';
import { sha512 } from 'js-sha512';

import { wcifRoleToAttendanceRole } from '../../src/wcif-helpers';

const prisma = new PrismaClient();

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

export async function seedDb() {
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
  const wcifFile = fs.readFileSync('./prisma/seed/wcif.json', 'utf8');
  const wcifJson: Competition = JSON.parse(wcifFile);
  await prisma.competition.create({
    data: {
      name: wcifJson.name,
      sendingResultsFrequency: SendingResultsFrequency.AFTER_SOLVE,
      wcaId: wcifJson.id,
      countryIso2: 'PL',
      shouldUpdateDevices: true,
      wifiSsid: 'FKM',
      wifiPassword: 'FKM',
      scoretakingToken: 'wca-live-token',
      scoretakingTokenUpdatedAt: new Date(),
      wcif: JSON.parse(wcifFile),
    },
  });
  await prisma.person.createMany({
    data: wcifJson.persons.map((person: Person) => ({
      wcaId: person.wcaId,
      name: person.name,
      registrantId: person.registrantId,
      gender: person.gender,
      countryIso2: person.countryIso2,
      canCompete: person.registration && person.registration.isCompeting,
    })),
  });
  const rooms = [];

  for (const venue of wcifJson.schedule.venues) {
    for (const room of venue.rooms) {
      rooms.push({
        name: room.name,
        color: room.color,
      });
    }
  }
  const staffActivitiesTransactions = [];

  wcifJson.persons.forEach((person: Person) => {
    person.assignments.forEach((assignment: Assignment) => {
      const group = getGroupInfoByActivityId(assignment.activityId, wcifJson);
      staffActivitiesTransactions.push(
        prisma.staffActivity.create({
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
  await prisma.$transaction(staffActivitiesTransactions);
  await prisma.room.createMany({
    data: rooms,
  });
  console.log('Test database seeded');
}
seedDb()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
