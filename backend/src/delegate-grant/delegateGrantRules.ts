import {
  AttemptStatus,
  AttemptType,
  DelegateGrantPermission,
} from '@prisma/client';
import { activityCodeToName } from '@wca/helpers';
import { DNF_VALUE, DNS_VALUE } from 'src/constants';

/**
 * Resolving an incident is part of every grant (SPEC-013); it isn't one of
 * the permissions a delegate ticks.
 */
export const RESOLVE_INCIDENT = 'RESOLVE_INCIDENT';

export type GrantAction = DelegateGrantPermission | typeof RESOLVE_INCIDENT;

/** What the dialog ticks when a delegate gives access */
export const DEFAULT_GRANT_PERMISSIONS: DelegateGrantPermission[] = [
  DelegateGrantPermission.GIVE_EXTRA,
  DelegateGrantPermission.ADD_ATTEMPT,
  DelegateGrantPermission.REORDER_ATTEMPTS,
];

/** How a refusal names the action: "…doesn't include deleting attempts" */
export const ACTION_LABELS: Record<GrantAction, string> = {
  RESOLVE_INCIDENT: 'resolving incidents',
  GIVE_EXTRA: 'giving extras',
  ADD_ATTEMPT: 'adding attempts',
  REORDER_ATTEMPTS: 'reordering attempts',
  EDIT_ATTEMPT: 'editing attempts',
  DELETE_ATTEMPT: 'deleting attempts',
  EXTRAS_FOR_SEVERAL: 'giving extras for several attempts',
  DNF_ALL: 'ruling all attempts DNF',
};

export const groupName = (groupId: string) => {
  try {
    return activityCodeToName(groupId);
  } catch {
    return groupId;
  }
};

export const isGrantRunning = (
  grant: { groupId: string },
  rooms: { currentGroupIds: string[] }[],
) => rooms.some((room) => room.currentGroupIds.includes(grant.groupId));

type AttemptFields = {
  status: AttemptStatus;
  type: AttemptType;
  attemptNumber: number;
  value: number;
  penalty: number | null;
};

/**
 * Which grant permission a PUT /attempt/:id needs. One endpoint serves the
 * incident form, "Give extra attempt" and the edit form, so the change
 * itself says which it was.
 */
export const actionForAttemptUpdate = (
  before: AttemptFields,
  after: AttemptFields,
): GrantAction => {
  const givesExtra =
    after.status === AttemptStatus.EXTRA_GIVEN &&
    before.status !== AttemptStatus.EXTRA_GIVEN;
  if (before.status === AttemptStatus.UNRESOLVED) {
    return givesExtra ? DelegateGrantPermission.GIVE_EXTRA : RESOLVE_INCIDENT;
  }
  const sameSolve =
    before.value === after.value &&
    (before.penalty ?? 0) === (after.penalty ?? 0) &&
    before.attemptNumber === after.attemptNumber &&
    before.type === after.type;
  if (givesExtra && sameSolve) return DelegateGrantPermission.GIVE_EXTRA;
  return DelegateGrantPermission.EDIT_ATTEMPT;
};

/** "12.34", "1:02.34", "DNF", "12.84 (+2)" */
export const formatAttemptTime = (attempt: {
  value: number;
  penalty: number | null;
}) => {
  if (attempt.penalty === DNF_VALUE) return 'DNF';
  if (attempt.penalty === DNS_VALUE) return 'DNS';
  const penalty = attempt.penalty ?? 0;
  const total = attempt.value + penalty * 100;
  const minutes = Math.floor(total / 6000);
  const seconds = ((total % 6000) / 100).toFixed(2);
  const clock =
    minutes > 0 ? `${minutes}:${seconds.padStart(5, '0')}` : seconds;
  return penalty > 0 ? `${clock} (+${penalty})` : clock;
};

/** "attempt 2", "extra 1" */
export const attemptLabel = (attempt: {
  type: AttemptType;
  attemptNumber: number;
}) =>
  `${attempt.type === AttemptType.EXTRA_ATTEMPT ? 'extra' : 'attempt'} ${
    attempt.attemptNumber
  }`;

/**
 * One line for the delegate's list of what the grantee did with an
 * attempt: "Resolved attempt 2: 12.34 → 12.84 (+2)".
 */
export const describeAttemptUpdate = (
  action: GrantAction,
  before: AttemptFields,
  after: AttemptFields,
) => {
  const label = attemptLabel(before);
  const from = formatAttemptTime(before);
  const to = formatAttemptTime(after);
  const change = from === to ? to : `${from} → ${to}`;
  switch (action) {
    case RESOLVE_INCIDENT:
      return `Resolved ${label}: ${change}`;
    case DelegateGrantPermission.GIVE_EXTRA:
      return before.status === AttemptStatus.UNRESOLVED
        ? `Gave an extra for ${label} (${change})`
        : `Gave an extra for ${label} (${to})`;
    default:
      return `Edited ${label}: ${change}`;
  }
};
