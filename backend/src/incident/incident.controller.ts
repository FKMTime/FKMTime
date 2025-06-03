import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GetUser } from 'src/auth/decorator/getUser.decorator';
import { JwtAuthDto } from 'src/auth/dto/jwt-auth.dto';
import { DelegateGuard } from 'src/auth/guards/delegate.guard';

import { ManualIncidentDto } from './dto/manualIncident.dto';
import { NoteworthyIncidentDto } from './dto/noteworthyIncident.dto';
import { WarningDto } from './dto/warning.dto';
import { IncidentService } from './incident.service';

@UseGuards(AuthGuard('jwt'), DelegateGuard)
@Controller('incident')
export class IncidentController {
  constructor(private readonly incidentService: IncidentService) {}

  @Get('unresolved')
  async getUnresolvedAttempts() {
    return this.incidentService.getUnresolvedIncidents();
  }

  @Get('unresolved/count')
  async getUnresolvedIncidentsCount() {
    return this.incidentService.getUnresolvedIncidentsCount();
  }

  @Get('resolved')
  async getResolvedIncidents(@Query('search') search: string) {
    return this.incidentService.getResolvedIncidents(search);
  }

  @Get('noteworthy')
  async getNoteworthyIncidents(@Query('search') search: string) {
    return this.incidentService.getNoteworthyIncidents(search);
  }

  @Post('noteworthy')
  async createNoteworthyIncident(
    @GetUser() user: JwtAuthDto,
    @Body() data: NoteworthyIncidentDto,
  ) {
    return this.incidentService.createNoteworthyIncident(data, user.userId);
  }

  @Put('noteworthy/:id')
  async updateNoteworthyIncident(
    @Param('id') id: string,
    @Body() data: NoteworthyIncidentDto,
  ) {
    return this.incidentService.updateNoteworthyIncident(id, data);
  }

  @Post('noteworthy/save/:id')
  async addAttemptAsNoteworthyIncident(
    @Param('id') attemptId: string,
    @GetUser() user: JwtAuthDto,
  ) {
    return this.incidentService.addAttemptAsNoteworthyIncident(
      attemptId,
      user.userId,
    );
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('noteworthy/:id')
  async deleteNoteworthyIncident(@Param('id') id: string) {
    return this.incidentService.deleteNoteworthyIncident(id);
  }

  @Get('warnings')
  async getAllWarnings(@Query('search') search: string) {
    return this.incidentService.getAllWarnings(search);
  }

  @Get('warnings/person/:id')
  async getWarningsByPerson(@Param('id') personId: string) {
    return this.incidentService.getWarningsForPerson(personId);
  }

  @Post('warnings/person/:id')
  async addWarningToPerson(
    @Param('id') personId: string,
    @Body() data: WarningDto,
    @GetUser() user: JwtAuthDto,
  ) {
    return this.incidentService.issueWarning(personId, data, user.userId);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('warnings/:id')
  async deleteWarning(@Param('id') id: string) {
    return this.incidentService.deleteWarning(id);
  }

  @Get('manual')
  async getManualIncidents(@Query('search') search: string) {
    console.log('Fetching manual incidents with search:', search);
    return this.incidentService.getManualIncidents(search);
  }

  @Post('manual')
  async createManualIncident(
    @GetUser() user: JwtAuthDto,
    @Body() data: ManualIncidentDto,
  ) {
    return this.incidentService.createManualIncident(data, user.userId);
  }

  @Put('manual/:id')
  async updateManualIncident(
    @Param('id') id: string,
    @Body() data: ManualIncidentDto,
  ) {
    return this.incidentService.updateManualIncident(id, data);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('manual/:id')
  async deleteManualIncident(@Param('id') id: string) {
    return this.incidentService.deleteManualIncident(id);
  }
}
