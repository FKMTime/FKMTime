import { Module } from '@nestjs/common';

import { AttemptEditLogService } from './attempt-edit-log.service';

@Module({
  providers: [AttemptEditLogService],
  exports: [AttemptEditLogService],
})
export class AttemptEditLogModule {}
