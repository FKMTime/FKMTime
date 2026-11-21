import { HttpException } from '@nestjs/common';

import { Role } from '../generated/prisma/client';
import { CHOOSE_ROOMS_MESSAGE, resolveStageLeadRooms } from './stageLeadRooms';

const ROOMS = ['main', 'side', 'annex'];
const stageLead = [Role.STAGE_LEADER];

describe('resolveStageLeadRooms', () => {
  it('saves the chosen rooms', () => {
    expect(
      resolveStageLeadRooms(stageLead, { stageLeadRoomIds: ['main'] }, ROOMS),
    ).toEqual(['main']);
  });

  it('saves all rooms as no rows', () => {
    expect(
      resolveStageLeadRooms(stageLead, { stageLeadAllRooms: true }, ROOMS),
    ).toEqual([]);
  });

  it('treats every room ticked by hand as all rooms', () => {
    expect(
      resolveStageLeadRooms(stageLead, { stageLeadRoomIds: ROOMS }, ROOMS),
    ).toEqual([]);
  });

  it.each([
    ['nothing', {}],
    ['an empty list', { stageLeadRoomIds: [] }],
    ['all rooms off', { stageLeadAllRooms: false }],
    ['both', { stageLeadAllRooms: true, stageLeadRoomIds: ['main'] }],
  ])('refuses a stage lead with %s', (_, input) => {
    expect(() => resolveStageLeadRooms(stageLead, input, ROOMS)).toThrow(
      new HttpException(CHOOSE_ROOMS_MESSAGE, 400),
    );
  });

  it('refuses a room that does not exist', () => {
    expect(() =>
      resolveStageLeadRooms(stageLead, { stageLeadRoomIds: ['gone'] }, ROOMS),
    ).toThrow('Room not found');
  });

  it.each([
    [[Role.STAFF]],
    [[Role.STAGE_LEADER, Role.ORGANIZER]],
    [[Role.DELEGATE]],
  ])('clears rooms for %j', (roles) => {
    expect(
      resolveStageLeadRooms(roles, { stageLeadRoomIds: ['main'] }, ROOMS),
    ).toEqual([]);
  });
});
