import { BadRequestException, PipeTransform } from '@nestjs/common';

import { roundIdRegex } from './constants';

const pattern = new RegExp(roundIdRegex);

/** Rejects a round id path parameter that isn't a WCIF round id like 333-r1 */
export class ParseRoundIdPipe implements PipeTransform<string, string> {
  transform(value: string) {
    if (typeof value !== 'string' || !pattern.test(value)) {
      throw new BadRequestException('Invalid round id');
    }
    return value;
  }
}
