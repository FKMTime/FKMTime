import {
  Attempt,
  AttemptStatus,
  AttemptType,
  StaffActivity,
  StaffActivityStatus,
  StaffRole,
} from '@prisma/client';
import { DNS_VALUE } from 'src/constants';

type AttemptWithPerson = Attempt & {
  result: { personId: string; roundId: string; person: { name: string } };
};

export interface StaffingWarning {
  role: 'JUDGE' | 'SCRAMBLER';
  groupId: string;
  staffedAttemptId: string;
  staffedResultId: string;
  staffedPersonName: string;
  staffedAttemptNumber: number;
  staffedAttemptType: AttemptType;
}

export function getStaffingWarnings(
  attempts: AttemptWithPerson[],
  attendance: Pick<StaffActivity, 'personId' | 'groupId' | 'role' | 'status'>[],
): Map<string, StaffingWarning[]> {
  const groupsByPersonAndRound = new Map<string, Set<string>>();
  const key = (personId: string, roundId: string) => `${personId}/${roundId}`;
  for (const activity of attendance) {
    if (
      activity.role !== StaffRole.COMPETITOR ||
      activity.status !== StaffActivityStatus.PRESENT
    ) {
      continue;
    }
    const personRound = key(activity.personId, activity.groupId.split('-g')[0]);
    const groups = groupsByPersonAndRound.get(personRound) ?? new Set<string>();
    groups.add(activity.groupId);
    groupsByPersonAndRound.set(personRound, groups);
  }

  // Attempts do not store their group. Only infer it when attendance identifies
  // exactly one attended competitor group in the round; assignments alone and
  // current device/room groups cannot establish where an attempt took place.
  const groupFor = (attempt: AttemptWithPerson) => {
    const groups = groupsByPersonAndRound.get(
      key(attempt.result.personId, attempt.result.roundId),
    );
    return groups?.size === 1 ? [...groups][0] : undefined;
  };
  const competingAttempts = new Map<string, AttemptWithPerson[]>();
  for (const attempt of attempts) {
    if (
      !attempt.solvedAt ||
      attempt.status === AttemptStatus.SCRAMBLED ||
      attempt.penalty === DNS_VALUE
    ) {
      continue;
    }
    const group = groupFor(attempt);
    if (!group) continue;
    const personGroup = key(attempt.result.personId, group);
    const existing = competingAttempts.get(personGroup) ?? [];
    existing.push(attempt);
    competingAttempts.set(personGroup, existing);
  }

  const warnings = new Map<string, StaffingWarning[]>();
  for (const staffed of attempts) {
    const groupId = groupFor(staffed);
    if (!groupId) continue;
    const roles = [
      {
        role: StaffRole.JUDGE,
        personId: staffed.judgeId,
        time:
          staffed.status !== AttemptStatus.SCRAMBLED ? staffed.solvedAt : null,
      },
      {
        role: StaffRole.SCRAMBLER,
        personId: staffed.scramblerId,
        // A recorded solve provides an upper bound when scrambling time is absent.
        time: staffed.scrambledAt ?? staffed.solvedAt,
      },
    ] as const;
    for (const { role, personId, time } of roles) {
      if (!personId || !time || personId === staffed.result.personId) continue;
      for (const competed of competingAttempts.get(key(personId, groupId)) ??
        []) {
        if (time.getTime() >= competed.solvedAt.getTime()) continue;
        const existing = warnings.get(competed.id) ?? [];
        existing.push({
          role,
          groupId,
          staffedAttemptId: staffed.id,
          staffedResultId: staffed.resultId,
          staffedPersonName: staffed.result.person.name,
          staffedAttemptNumber: staffed.attemptNumber,
          staffedAttemptType: staffed.type,
        });
        warnings.set(competed.id, existing);
      }
    }
  }
  return warnings;
}
