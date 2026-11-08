import {
  DNF_RULING_UNDONE,
  getPenaltyBeforeRuling,
  RULED_DNF,
} from './dnfRuling';

const at = (minute: number) => new Date(2026, 0, 1, 10, minute);
const entered = { comment: 'Entered', penalty: 2, editedAt: at(0) };
const ruled = { comment: RULED_DNF, penalty: -1, editedAt: at(5) };

describe('getPenaltyBeforeRuling', () => {
  it('reads the penalty from the entry before the ruling', () => {
    expect(getPenaltyBeforeRuling(-1, [ruled, entered])).toEqual({
      penalty: 2,
    });
  });

  it('keeps a missing penalty as it was', () => {
    expect(
      getPenaltyBeforeRuling(-1, [{ ...entered, penalty: null }, ruled]),
    ).toEqual({ penalty: null });
  });

  it('ignores an attempt that is no longer DNF', () => {
    expect(getPenaltyBeforeRuling(0, [entered, ruled])).toBeUndefined();
  });

  it('ignores an attempt that was never ruled DNF', () => {
    expect(
      getPenaltyBeforeRuling(-1, [
        entered,
        { comment: 'Updated', penalty: -1, editedAt: at(5) },
      ]),
    ).toBeUndefined();
  });

  it('ignores a ruling that was undone', () => {
    expect(
      getPenaltyBeforeRuling(-1, [
        entered,
        ruled,
        { comment: DNF_RULING_UNDONE, penalty: 2, editedAt: at(6) },
        { comment: 'Updated', penalty: -1, editedAt: at(7) },
      ]),
    ).toBeUndefined();
  });

  it('ignores a ruling whose penalty was changed by hand since', () => {
    expect(
      getPenaltyBeforeRuling(-1, [
        entered,
        ruled,
        { comment: 'Updated', penalty: 0, editedAt: at(6) },
        { comment: 'Updated', penalty: -1, editedAt: at(7) },
      ]),
    ).toBeUndefined();
  });

  it('keeps a ruling through changes that leave it DNF', () => {
    expect(
      getPenaltyBeforeRuling(-1, [
        entered,
        ruled,
        { comment: 'Swapped with attempt 2', penalty: -1, editedAt: at(6) },
      ]),
    ).toEqual({ penalty: 2 });
  });

  it('uses the latest ruling', () => {
    expect(
      getPenaltyBeforeRuling(-1, [
        entered,
        ruled,
        { comment: DNF_RULING_UNDONE, penalty: 2, editedAt: at(6) },
        { comment: 'Updated', penalty: 0, editedAt: at(7) },
        { ...ruled, editedAt: at(8) },
      ]),
    ).toEqual({ penalty: 0 });
  });
});
