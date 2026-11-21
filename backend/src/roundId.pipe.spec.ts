import { BadRequestException } from '@nestjs/common';

import { ParseRoundIdPipe } from './roundId.pipe';

describe('ParseRoundIdPipe', () => {
  const pipe = new ParseRoundIdPipe();

  it.each(['333-r1', '333fm-r2', '333mbf-r1', '444bf-r3'])(
    'accepts the round id %s',
    (roundId) => {
      expect(pipe.transform(roundId)).toBe(roundId);
    },
  );

  it.each([
    '../../../OtherComp2026/live/rounds/333-r1',
    '333-r1/../../x',
    '333-r1?x=',
    '333-r1#',
    'x/../y#-r1',
    '333',
    '',
  ])('rejects %p', (roundId) => {
    expect(() => pipe.transform(roundId)).toThrow(BadRequestException);
  });
});
