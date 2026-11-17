import {
  BadRequestException,
  Controller,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';

import { AdminGuard } from '../auth/guards/admin.guard';
import { isServerLogSource } from './serverLog';
import { ServerLogService } from './serverLog.service';

@Controller('server-logs')
export class ServerLogController {
  constructor(private readonly serverLogService: ServerLogService) {}

  /** A server log's whole file, for admins (SPEC-011) */
  @UseGuards(AdminGuard)
  @Get(':source')
  async downloadServerLog(@Param('source') source: string) {
    if (!isServerLogSource(source)) {
      throw new BadRequestException('Unknown log');
    }
    return this.serverLogService.download(source);
  }
}
