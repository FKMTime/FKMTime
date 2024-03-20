import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { CreateAttendaceDto } from './dto/createAttendance.dto';
import { AuthGuard } from '@nestjs/passport';
import { AdminOrDelegateGuard } from '../auth/guards/adminOrDelegate.guard';
import { MarkAsPresentDto } from './dto/markAsPresent.dto';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @UseGuards(AuthGuard('jwt'), AdminOrDelegateGuard)
  @Get('group/:groupId')
  async getAttendanceByGroupId(@Param('groupId') groupId: string) {
    return this.attendanceService.getAttendanceByGroupId(groupId);
  }

  @Post()
  async createAttendance(@Body() data: CreateAttendaceDto) {
    return this.attendanceService.createAttendance(data);
  }

  @UseGuards(AuthGuard('jwt'), AdminOrDelegateGuard)
  @Get('person/:id')
  async getAttendanceByPerson(@Param('id') id: string) {
    return this.attendanceService.getAttendanceByPerson(id);
  }

  @UseGuards(AuthGuard('jwt'), AdminOrDelegateGuard)
  @Post('mark-as-present')
  async markAsPresent(@Body() data: MarkAsPresentDto) {
    return this.attendanceService.markAsPresent(data);
  }
}
