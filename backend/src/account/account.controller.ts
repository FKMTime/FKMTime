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
import { AdminGuard } from 'src/auth/guards/admin.guard';
import { UpdatePasswordDto } from './dto/updatePassword.dto';

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

  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async deleteAccount(@Param('id') id: string) {
    return await this.accountService.deleteAccount(id);
  }
}
