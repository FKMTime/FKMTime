import { Competition, Event, Round } from '@wca/helpers';
import { getEventInfoFromWcif } from 'wcif-helpers';

export const wcifRoleToAttendanceRole = (role: string) => {
  switch (role) {
    case 'staff-judge':
      return 'JUDGE';
    case 'staff-runner':
      return 'RUNNER';
    case 'staff-scrambler':
      return 'SCRAMBLER';
    default:
      return 'COMPETITOR';
  }
};

export const isCumulativeLimit = (roundId: string, wcif: Competition) => {
  const eventId = roundId.split('-')[0];
  const event: Event = getEventInfoFromWcif(eventId, wcif);
  const round: Round = event.rounds.find((r) => r.id === roundId);
  return round.timeLimit.cumulativeRoundIds.length > 0;
};
