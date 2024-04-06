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
import { AdminGuard } from 'src/auth/guards/admin.guard';
import { AccountService } from './account.service';
import { CreateAccountDto } from './dto/createAccount.dto';
import { UpdateAccountDto } from './dto/updateAccount.dto';
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
  @Post()
  async createAccount(@Body() data: CreateAccountDto) {
    return await this.accountService.createAccount(data);
  }

  @UseGuards(AdminGuard)
  @Put('password/:id')
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
