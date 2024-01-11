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
import { AdminGuard } from 'src/auth/guards/admin.guard';
import { UpdateAccountDto } from './dto/updateAccount.dto';

@UseGuards(AdminGuard)
@Controller('account')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get()
  async getAllAccounts() {
    return await this.accountService.getAllAccounts();
  }

  @Put(':id')
  async updateAccount(@Param('id') id: number, @Body() data: UpdateAccountDto) {
    return await this.accountService.updateAccount(id, data);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async deleteAccount(@Param('id') id: number) {
    return await this.accountService.deleteAccount(id);
  }
}
