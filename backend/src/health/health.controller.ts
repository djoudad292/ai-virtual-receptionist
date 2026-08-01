import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('api/health')
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
