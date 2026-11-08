import { AttemptStatus } from '@prisma/client';

import {
  DNF_RULING_UNDONE,
  getStateBeforeRuling,
  REMAINING_RULED_DNF,
  RULED_DNF,
} from './dnfRuling';

const at = (minute: number) => new Date(2026, 0, 1, 10, minute);
const entered = { comment: 'Entered', penalty: 2, editedAt: at(0) };
const ruled = { comment: RULED_DNF, penalty: -1, editedAt: at(5) };

describe('getStateBeforeRuling', () => {
  it('reads the penalty from the entry before the ruling', () => {
    expect(getStateBeforeRuling(-1, [ruled, entered])).toMatchObject({
      penalty: 2,
    });
  });

  it('keeps a missing penalty as it was', () => {
    expect(
      getStateBeforeRuling(-1, [{ ...entered, penalty: null }, ruled]),
    ).toMatchObject({ penalty: null });
  });

  it('ignores an attempt that is no longer DNF', () => {
    expect(getStateBeforeRuling(0, [entered, ruled])).toBeUndefined();
  });

  it('ignores an attempt that was never ruled DNF', () => {
    expect(
      getStateBeforeRuling(-1, [
        entered,
        { comment: 'Updated', penalty: -1, editedAt: at(5) },
      ]),
    ).toBeUndefined();
  });

  it('ignores a ruling that was undone', () => {
    expect(
      getStateBeforeRuling(-1, [
        entered,
        ruled,
        { comment: DNF_RULING_UNDONE, penalty: 2, editedAt: at(6) },
        { comment: 'Updated', penalty: -1, editedAt: at(7) },
      ]),
    ).toBeUndefined();
  });

  it('ignores a ruling whose penalty was changed by hand since', () => {
    expect(
      getStateBeforeRuling(-1, [
        entered,
        ruled,
        { comment: 'Updated', penalty: 0, editedAt: at(6) },
        { comment: 'Updated', penalty: -1, editedAt: at(7) },
      ]),
    ).toBeUndefined();
  });

  it('keeps a ruling through changes that leave it DNF', () => {
    expect(
      getStateBeforeRuling(-1, [
        entered,
        ruled,
        { comment: 'Swapped with attempt 2', penalty: -1, editedAt: at(6) },
      ]),
    ).toMatchObject({ penalty: 2 });
  });

  it('marks a remaining attempt the ruling recorded', () => {
    expect(
      getStateBeforeRuling(-1, [{ ...ruled, comment: REMAINING_RULED_DNF }]),
    ).toEqual({ addedByRuling: true });
  });

  it('brings back the status from before the ruling', () => {
    expect(
      getStateBeforeRuling(-1, [
        { ...entered, status: AttemptStatus.SCRAMBLED },
        ruled,
      ]),
    ).toMatchObject({ penalty: 2, status: AttemptStatus.SCRAMBLED });
  });

  it('uses the latest ruling', () => {
    expect(
      getStateBeforeRuling(-1, [
        entered,
        ruled,
        { comment: DNF_RULING_UNDONE, penalty: 2, editedAt: at(6) },
        { comment: 'Updated', penalty: 0, editedAt: at(7) },
        { ...ruled, editedAt: at(8) },
      ]),
    ).toMatchObject({ penalty: 0 });
  });
});
