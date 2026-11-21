import { AttemptStatus, AttemptType } from '../generated/prisma/client';
import {
  actionForAttemptUpdate,
  describeAttemptUpdate,
  formatAttemptTime,
  isGrantRunning,
  RESOLVE_INCIDENT,
} from './delegateGrantRules';

const attempt = (
  fields: Partial<Parameters<typeof formatAttemptTime>[0]> & {
    status?: AttemptStatus;
    type?: AttemptType;
    attemptNumber?: number;
  },
) => ({
  status: AttemptStatus.STANDARD,
  type: AttemptType.STANDARD_ATTEMPT,
  attemptNumber: 2,
  value: 1234,
  penalty: 0,
  ...fields,
});

describe('actionForAttemptUpdate', () => {
  it('treats saving an incident as resolving it', () => {
    const before = attempt({ status: AttemptStatus.UNRESOLVED });
    expect(
      actionForAttemptUpdate(before, {
        ...before,
        status: AttemptStatus.RESOLVED,
        penalty: 2,
      }),
    ).toBe(RESOLVE_INCIDENT);
  });

  it('treats an extra on an incident as giving an extra', () => {
    const before = attempt({ status: AttemptStatus.UNRESOLVED });
    expect(
      actionForAttemptUpdate(before, {
        ...before,
        status: AttemptStatus.EXTRA_GIVEN,
      }),
    ).toBe('GIVE_EXTRA');
  });

  it('treats an extra on an unchanged attempt as giving an extra', () => {
    const before = attempt({});
    expect(
      actionForAttemptUpdate(before, {
        ...before,
        status: AttemptStatus.EXTRA_GIVEN,
      }),
    ).toBe('GIVE_EXTRA');
  });

  it('needs editing when an extra also changes the time', () => {
    const before = attempt({});
    expect(
      actionForAttemptUpdate(before, {
        ...before,
        status: AttemptStatus.EXTRA_GIVEN,
        value: 999,
      }),
    ).toBe('EDIT_ATTEMPT');
  });

  it('needs editing for a new penalty on an attempt that is not an incident', () => {
    const before = attempt({});
    expect(actionForAttemptUpdate(before, { ...before, penalty: 2 })).toBe(
      'EDIT_ATTEMPT',
    );
  });
});

describe('formatAttemptTime', () => {
  it.each([
    [{ value: 1234, penalty: 0 }, '12.34'],
    [{ value: 6234, penalty: 0 }, '1:02.34'],
    [{ value: 1234, penalty: 2 }, '14.34 (+2)'],
    [{ value: 1234, penalty: -1 }, 'DNF'],
    [{ value: 0, penalty: -2 }, 'DNS'],
  ])('%j → %s', (input, expected) => {
    expect(formatAttemptTime(input)).toBe(expected);
  });
});

describe('describeAttemptUpdate', () => {
  it('says what resolving changed', () => {
    const before = attempt({ status: AttemptStatus.UNRESOLVED });
    expect(
      describeAttemptUpdate(RESOLVE_INCIDENT, before, {
        ...before,
        status: AttemptStatus.RESOLVED,
        penalty: 2,
      }),
    ).toBe('Resolved attempt 2: 12.34 → 14.34 (+2)');
  });

  it('names an extra by its own number', () => {
    const before = attempt({
      type: AttemptType.EXTRA_ATTEMPT,
      attemptNumber: 1,
    });
    expect(
      describeAttemptUpdate('GIVE_EXTRA', before, {
        ...before,
        status: AttemptStatus.EXTRA_GIVEN,
      }),
    ).toBe('Gave an extra for extra 1 (12.34)');
  });
});

describe('isGrantRunning', () => {
  it('runs while any room runs the group', () => {
    const rooms = [
      { currentGroupIds: ['222-r1-g1'] },
      { currentGroupIds: ['333-r1-g2'] },
    ];
    expect(isGrantRunning({ groupId: '333-r1-g2' }, rooms)).toBe(true);
    expect(isGrantRunning({ groupId: '333-r1-g1' }, rooms)).toBe(false);
  });
});
