import { HttpException } from '@nestjs/common';

import { isScopedStageLead } from '../attendance/attendanceScope';
import { Role } from '../generated/prisma/client';

export const CHOOSE_ROOMS_MESSAGE =
  'Choose the rooms this stage lead takes attendance in';

/** What the create and edit user requests say about a stage lead's rooms */
export interface StageLeadRoomsInput {
  stageLeadAllRooms?: boolean;
  stageLeadRoomIds?: string[];
}

/**
 * The rooms to save for a user (SPEC-016): none for all rooms or for anyone
 * whose rooms don't matter, otherwise the chosen ones. A stage lead must say
 * which: all rooms, or at least one existing room, not both.
 */
export const resolveStageLeadRooms = (
  roles: Role[],
  input: StageLeadRoomsInput,
  existingRoomIds: string[],
): string[] => {
  if (!isScopedStageLead(roles)) return [];
  const roomIds = [...new Set(input.stageLeadRoomIds ?? [])];
  if (input.stageLeadAllRooms) {
    if (roomIds.length > 0) throw new HttpException(CHOOSE_ROOMS_MESSAGE, 400);
    return [];
  }
  if (roomIds.length === 0) throw new HttpException(CHOOSE_ROOMS_MESSAGE, 400);
  if (roomIds.some((id) => !existingRoomIds.includes(id))) {
    throw new HttpException('Room not found', 400);
  }
  // Every room ticked by hand is all rooms, including ones added later
  return existingRoomIds.every((id) => roomIds.includes(id)) ? [] : roomIds;
};
