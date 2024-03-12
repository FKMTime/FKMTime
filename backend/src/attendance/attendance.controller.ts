import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { CreateAttendaceDto } from './dto/createAttendance.dto';
import { AuthGuard } from '@nestjs/passport';
import { AdminOrDelegateGuard } from '../auth/guards/adminOrDelegate.guard';

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
  @Get('person/:cardId')
  async getAttendanceByPerson(@Param('cardId') cardId: string) {
    return this.attendanceService.getAttendanceByPerson(cardId);
  }
}
