import {
  Attempt,
  AttemptStatus,
  AttemptType,
  StaffActivityStatus,
  StaffRole,
} from '@prisma/client';
import { DNF_VALUE, DNS_VALUE } from 'src/constants';

import { getStaffingWarnings } from './staffingWarnings';

const at = (minute: number) => new Date(Date.UTC(2026, 8, 30, 12, minute));
const attempt = (
  id: string,
  personId: string,
  minute: number,
  overrides: Partial<Attempt> = {},
  roundId = '333-r1',
) => ({
  id,
  resultId: `${personId}/${roundId}`,
  sessionId: null,
  attemptNumber: 1,
  replacedBy: null,
  comment: null,
  type: AttemptType.STANDARD_ATTEMPT,
  status: AttemptStatus.STANDARD,
  penalty: 0,
  value: 1000,
  originalTime: null,
  inspectionTime: null,
  judgeId: null,
  scramblerId: null,
  scrambledAt: null,
  deviceId: null,
  solvedAt: at(minute),
  createdAt: at(minute),
  updatedAt: at(minute),
  updatedById: null,
  ...overrides,
  result: { personId, roundId, person: { name: personId } },
});
const attendance = (personId: string, groupId = '333-r1-g1') => ({
  personId,
  groupId,
  role: StaffRole.COMPETITOR,
  status: StaffActivityStatus.PRESENT,
});

describe('getStaffingWarnings', () => {
  const present = [attendance('Alice'), attendance('Bob')];
  const competed = attempt('competed', 'Alice', 10);
  const judged = attempt('staffed', 'Bob', 5, { judgeId: 'Alice' });

  it('flags the later competing attempt and identifies the staffed attempt', () => {
    const warnings = getStaffingWarnings([competed, judged], present);
    expect([...warnings.keys()]).toEqual(['competed']);
    expect(warnings.get('competed')).toEqual([
      {
        role: 'JUDGE',
        groupId: '333-r1-g1',
        staffedAttemptId: 'staffed',
        staffedResultId: 'Bob/333-r1',
        staffedPersonName: 'Bob',
        staffedAttemptNumber: 1,
        staffedAttemptType: AttemptType.STANDARD_ATTEMPT,
      },
    ]);
  });

  it('uses scrambling time even if the staffed attempt is solved later', () => {
    const scrambled = attempt('scrambled', 'Bob', 15, {
      scramblerId: 'Alice',
      scrambledAt: at(5),
    });
    expect(
      getStaffingWarnings([competed, scrambled], present).get('competed'),
    ).toEqual([expect.objectContaining({ role: 'SCRAMBLER' })]);
  });

  it('detects scrambling before the staffed attempt has been solved', () => {
    const scrambled = attempt('scrambled', 'Bob', 15, {
      scramblerId: 'Alice',
      scrambledAt: at(5),
      solvedAt: null,
      status: AttemptStatus.SCRAMBLED,
    });
    expect(
      getStaffingWarnings([competed, scrambled], present).has('competed'),
    ).toBe(true);
  });

  it('uses solve time as an upper bound when scrambling time is missing', () => {
    const scrambled = { ...judged, judgeId: null, scramblerId: 'Alice' };
    expect(
      getStaffingWarnings([competed, scrambled], present).get('competed'),
    ).toEqual([expect.objectContaining({ role: 'SCRAMBLER' })]);
  });

  it.each([10, 15])(
    'does not flag staffing at or after the solve (%i)',
    (minute) => {
      expect(
        getStaffingWarnings(
          [competed, { ...judged, solvedAt: at(minute) }],
          present,
        ).size,
      ).toBe(0);
    },
  );

  it('only flags later solves when staffing happens between attempts', () => {
    const earlier = attempt('earlier', 'Alice', 1);
    expect([
      ...getStaffingWarnings([earlier, judged, competed], present).keys(),
    ]).toEqual(['competed']);
  });

  it('does not match different groups, rounds, or events', () => {
    for (const group of ['333-r1-g2', '333-r2-g1', '222-r1-g1']) {
      expect(
        getStaffingWarnings(
          [competed, judged],
          [attendance('Alice'), attendance('Bob', group)],
        ).size,
      ).toBe(0);
    }
    const anotherRound = attempt(
      'other',
      'Bob',
      5,
      { judgeId: 'Alice' },
      '333-r2',
    );
    expect(getStaffingWarnings([competed, anotherRound], present).size).toBe(0);
  });

  it('skips missing, absent, staff-only, and ambiguous competitor attendance', () => {
    for (const records of [
      [attendance('Alice')],
      [
        attendance('Alice'),
        { ...attendance('Bob'), status: StaffActivityStatus.ABSENT },
      ],
      [attendance('Alice'), { ...attendance('Bob'), role: StaffRole.JUDGE }],
      [...present, attendance('Alice', '333-r1-g2')],
      [...present, attendance('Bob', '333-r1-g2')],
    ]) {
      expect(getStaffingWarnings([competed, judged], records).size).toBe(0);
    }
  });

  it('does not treat DNS, unsolved scrambles, or missing solve times as competing', () => {
    for (const overrides of [
      { penalty: DNS_VALUE },
      { status: AttemptStatus.SCRAMBLED },
      { solvedAt: null },
    ]) {
      expect(
        getStaffingWarnings([{ ...competed, ...overrides }, judged], present)
          .size,
      ).toBe(0);
    }
  });

  it('includes DNF, replaced, unresolved, and extra attempts', () => {
    for (const overrides of [
      { penalty: DNF_VALUE },
      { replacedBy: 1, status: AttemptStatus.EXTRA_GIVEN },
      { status: AttemptStatus.UNRESOLVED },
      { type: AttemptType.EXTRA_ATTEMPT },
    ]) {
      expect(
        getStaffingWarnings(
          [{ ...competed, ...overrides }, judged],
          present,
        ).has('competed'),
      ).toBe(true);
    }
  });

  it('preserves both roles and extra attempt details', () => {
    const both = {
      ...judged,
      scramblerId: 'Alice',
      type: AttemptType.EXTRA_ATTEMPT,
    };
    expect(
      getStaffingWarnings([competed, both], present).get('competed'),
    ).toEqual([
      expect.objectContaining({
        role: 'JUDGE',
        staffedAttemptType: AttemptType.EXTRA_ATTEMPT,
      }),
      expect.objectContaining({
        role: 'SCRAMBLER',
        staffedAttemptType: AttemptType.EXTRA_ATTEMPT,
      }),
    ]);
  });

  it('does not infer chronology from creation or edit timestamps', () => {
    expect(
      getStaffingWarnings([competed, { ...judged, solvedAt: null }], present)
        .size,
    ).toBe(0);
  });

  it('ignores self-staffing records', () => {
    const self = attempt('self', 'Alice', 1, {
      judgeId: 'Alice',
      scramblerId: 'Alice',
    });
    expect(getStaffingWarnings([competed, self], present).size).toBe(0);
  });
});
