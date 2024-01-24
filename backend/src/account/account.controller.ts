import { AuthService } from './../auth/auth.service';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AccountService } from './account.service';
import { UpdateAccountDto } from './dto/updateAccount.dto';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthDto } from 'src/auth/dto/jwt-auth.dto';
import { GetUser } from 'src/auth/decorator/getUser.decorator';

@UseGuards(AuthGuard('jwt'))
@Controller('account')
export class AccountController {
  constructor(
    private readonly accountService: AccountService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  async getAllAccounts(@GetUser() user: JwtAuthDto) {
    await this.authService.requireAdminRole(user.userId);
    return await this.accountService.getAllAccounts();
  }

  @Put(':id')
  async updateAccount(
    @Param('id') id: number,
    @Body() data: UpdateAccountDto,
    @GetUser() user: JwtAuthDto,
  ) {
    await this.authService.requireAdminRole(user.userId);
    return await this.accountService.updateAccount(id, data);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async deleteAccount(@Param('id') id: number, @GetUser() user: JwtAuthDto) {
    await this.authService.requireAdminRole(user.userId);
    return await this.accountService.deleteAccount(id);
  }
}
