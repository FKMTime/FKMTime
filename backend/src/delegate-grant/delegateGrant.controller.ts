import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GetUser } from 'src/auth/decorator/getUser.decorator';
import { JwtAuthDto } from 'src/auth/dto/jwt-auth.dto';
import { DelegateGuard } from 'src/auth/guards/delegate.guard';

import { DelegateGrantService } from './delegateGrant.service';
import { GiveDelegateGrantDto } from './dto/giveDelegateGrant.dto';

@UseGuards(AuthGuard('jwt'))
@Controller('delegate-grant')
export class DelegateGrantController {
  constructor(private readonly delegateGrantService: DelegateGrantService) {}

  /** The caller's own grants, active or waiting; any signed-in user */
  @Get('mine')
  async getMine(@GetUser() user: JwtAuthDto) {
    return this.delegateGrantService.getMine(user.userId);
  }

  /** Running and next groups every delegate competes in (SPEC-015) */
  @UseGuards(DelegateGuard)
  @Get('uncovered-groups')
  async getUncoveredGroups() {
    return this.delegateGrantService.getUncoveredGroups();
  }

  @UseGuards(DelegateGuard)
  @Get()
  async getGrants(@Query('groupId') groupId?: string) {
    return this.delegateGrantService.getGrants(groupId);
  }

  @UseGuards(DelegateGuard)
  @Post()
  async giveGrant(
    @Body() data: GiveDelegateGrantDto,
    @GetUser() user: JwtAuthDto,
  ) {
    return this.delegateGrantService.giveGrant(data, user.userId);
  }

  @UseGuards(DelegateGuard)
  @HttpCode(HttpStatus.OK)
  @Post(':id/end')
  async endGrant(@Param('id') id: string, @GetUser() user: JwtAuthDto) {
    return this.delegateGrantService.endGrant(id, user.userId);
  }

  @UseGuards(DelegateGuard)
  @Get(':id/actions')
  async getActions(@Param('id') id: string) {
    return this.delegateGrantService.getActions(id);
  }
}
