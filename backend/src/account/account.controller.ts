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
  UseGuards,
} from '@nestjs/common';
import { AccountService } from './account.service';
import { UpdateAccountDto } from './dto/updateAccount.dto';
import { AdminGuard } from 'src/auth/guards/admin.guard';
import { AuthGuard } from '@nestjs/passport';
import { GetUser } from 'src/auth/decorator/getUser.decorator';
import { UpdatePasswordDto } from './dto/updatePassword.dto';
import { AdminOrDelegateGuard } from '../auth/guards/adminOrDelegate.guard';

@Controller('account')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @UseGuards(AdminGuard)
  @Get()
  async getAllAccounts() {
    return this.accountService.getAllAccounts();
  }

  @UseGuards(AdminGuard)
  @Put(':id/password')
  async updatePassword(
    @Param('id') id: string,
    @Body() data: UpdatePasswordDto,
  ) {
    return await this.accountService.updatePassword(id, data.password);
  }

  @UseGuards(AdminGuard)
  @Put(':id')
  async updateAccount(@Param('id') id: string, @Body() data: UpdateAccountDto) {
    return await this.accountService.updateAccount(id, data);
  }

  @UseGuards(AuthGuard('jwt'), AdminOrDelegateGuard)
  @Post('notification-token')
  async updateNotificationToken(
    @GetUser('id') userId: string,
    @Body('token') token: string,
  ) {
    return await this.accountService.updateNotificationToken(userId, token);
  }

  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async deleteAccount(@Param('id') id: string) {
    return await this.accountService.deleteAccount(id);
  }
}
