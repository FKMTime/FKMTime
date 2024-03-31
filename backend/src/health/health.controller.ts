import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  constructor() {}

  @Get()
  async getHealth() {
    return { status: 'OK' };
  }
}
