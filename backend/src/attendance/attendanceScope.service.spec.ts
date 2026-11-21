import { ForbiddenException } from '@nestjs/common';

import { DbService } from '../db/db.service';
import { Role } from '../generated/prisma/client';
import { AttendanceScopeService } from './attendanceScope.service';

const mainHall = {
  id: 'main',
  name: 'Main Hall',
  currentGroupIds: ['333-r1-g2'],
  startedGroupIds: ['333-r1-g1', '444-r1-g1'],
};

const wcif = {
  schedule: {
    venues: [
      {
        rooms: [
          {
            name: 'Main Hall',
            activities: [
              {
                activityCode: '333-r1',
                childActivities: [
                  { activityCode: '333-r1-g1', childActivities: [] },
                  { activityCode: '333-r1-g3', childActivities: [] },
                ],
              },
            ],
          },
          {
            name: 'Side Hall',
            activities: [
              {
                activityCode: '222-r1',
                childActivities: [
                  { activityCode: '222-r1-g1', childActivities: [] },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
};

const setup = (roles: Role[], rooms = [mainHall]) => {
  const db = {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        roles,
        stageLeadRooms: rooms.map((room) => ({ room })),
      }),
    },
    competition: { findFirst: jest.fn().mockResolvedValue({ wcif }) },
    staffActivity: {
      findUnique: jest.fn().mockResolvedValue({ groupId: '222-r1-g1' }),
    },
  };
  return new AttendanceScopeService(db as unknown as DbService);
};

describe('AttendanceScopeService', () => {
  it.each([[Role.ADMIN], [Role.ORGANIZER], [Role.DELEGATE]])(
    '%s takes attendance anywhere, whatever rooms are stored',
    async (role) => {
      const service = setup([role]);
      await expect(service.assertGroup('u', '222-r1-g1')).resolves.toEqual(
        expect.objectContaining({ allRooms: true }),
      );
    },
  );

  it('a stage lead who is also an organizer takes attendance anywhere', async () => {
    const service = setup([Role.STAGE_LEADER, Role.ORGANIZER]);
    await expect(service.assertGroup('u', '222-r1-g1')).resolves.toBeDefined();
  });

  it('a stage lead with all rooms takes attendance anywhere', async () => {
    const service = setup([Role.STAGE_LEADER], []);
    expect((await service.scopeFor('u')).allRooms).toBe(true);
    await expect(service.assertActivity('u', 'a')).resolves.toBeUndefined();
  });

  describe('a stage lead with some rooms', () => {
    const service = setup([Role.STAGE_LEADER]);

    it.each([
      ['a scheduled group', '333-r1-g3'],
      ['a group the room started', '444-r1-g1'],
      ['the group the room is running', '333-r1-g2'],
    ])('covers %s', async (_, groupId) => {
      await expect(service.assertGroup('u', groupId)).resolves.toBeDefined();
    });

    it("refuses another room's group, naming their rooms", async () => {
      await expect(service.assertGroup('u', '222-r1-g1')).rejects.toThrow(
        new ForbiddenException('You take attendance for Main Hall only'),
      );
    });

    it("refuses an attendance row of another room's group", async () => {
      await expect(service.assertActivity('u', 'a')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('allows a day of groups once one of them is theirs', async () => {
      await expect(
        service.assertAnyGroup('u', ['222-r1-g1', '333-r1-g1']),
      ).resolves.toBeUndefined();
      await expect(service.assertAnyGroup('u', ['222-r1-g1'])).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('allows a round with one of their groups', async () => {
      await expect(service.assertRound('u', '333-r1')).resolves.toBeUndefined();
      await expect(service.assertRound('u', '222-r1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
