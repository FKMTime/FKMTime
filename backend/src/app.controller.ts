import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('health')
  async getHealth() {
    return { status: 'OK' };
  }
}
