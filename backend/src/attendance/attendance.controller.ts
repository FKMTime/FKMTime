import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AttendanceService } from './attendance.service';
import { CreateAttendaceDto } from './dto/createAttendance.dto';
import { MarkAsPresentDto } from './dto/markAsPresent.dto';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Get('group/:groupId')
  async getAttendanceByGroupId(@Param('groupId') groupId: string) {
    return this.attendanceService.getAttendanceByGroupId(groupId);
  }

  @Post()
  async createAttendance(@Body() data: CreateAttendaceDto) {
    return this.attendanceService.createAttendance(data);
  }

  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Get('person/:id')
  async getStaffActivitiesByPersonId(@Param('id') id: string) {
    return this.attendanceService.getStaffActivitiesByPersonId(id);
  }

  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Post('present/:id')
  async markAsPresent(@Param('id') id: string)  {
    return this.attendanceService.markAsPresent(id);
  }

  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Post('absent/:id')
  async markAsAbsent(@Param('id') id: string){
    return this.attendanceService.markAsAbsent(id);
  }
}
