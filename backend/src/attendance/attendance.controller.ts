import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { AdminGuard } from '../auth/guards/admin.guard';
import { AttendanceService } from './attendance.service';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Get('group/:groupId')
  async getAttendanceByGroupId(@Param('groupId') groupId: string) {
    return this.attendanceService.getAttendanceByGroupId(groupId);
  }

  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Get('statistics')
  async getAttendanceStatistics() {
    return this.attendanceService.getAttendanceStatistics();
  }

  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Get('person/:id')
  async getStaffActivitiesByPersonId(@Param('id') id: string) {
    return this.attendanceService.getStaffActivitiesByPersonId(id);
  }

  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Post('present/:id')
  async markAsPresent(@Param('id') id: string) {
    return this.attendanceService.markAsPresent(id);
  }

  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Post('absent/:id')
  async markAsAbsent(@Param('id') id: string) {
    return this.attendanceService.markAsAbsent(id);
  }
}
