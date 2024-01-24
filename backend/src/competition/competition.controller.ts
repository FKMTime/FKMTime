import { AuthService } from './../auth/auth.service';
import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { CompetitionService } from './competition.service';
import { UpdateCompetitionDto } from './dto/updateCompetition.dto';
import { AuthGuard } from '@nestjs/passport';
import { GetUser } from 'src/auth/decorator/getUser.decorator';
import { JwtAuthDto } from 'src/auth/dto/jwt-auth.dto';

@UseGuards(AuthGuard('jwt'))
@Controller('competition')
export class CompetitionController {
  constructor(
    private readonly competitionService: CompetitionService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  async getCompetitionInfo() {
    return await this.competitionService.getCompetitionInfo();
  }

  @Get('import/:id')
  async importCompetition(
    @Param('id') id: string,
    @GetUser() user: JwtAuthDto,
  ) {
    await this.authService.requireAdminRole(user.userId);
    return await this.competitionService.importCompetition(id);
  }

  @Get('sync/:id')
  async syncCompetition(@Param('id') id: string, @GetUser() user: JwtAuthDto) {
    await this.authService.requireAdminRole(user.userId);
    return await this.competitionService.updateWcif(id);
  }

  @Put('update/:id')
  async updateCompetition(
    @Param('id') id: number,
    @Body() dto: UpdateCompetitionDto,
    @GetUser() user: JwtAuthDto,
  ) {
    await this.authService.requireAdminRole(user.userId);
    return await this.competitionService.updateCompetition(+id, dto);
  }
}
