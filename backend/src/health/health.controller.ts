import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

@SkipThrottle()
@Controller()
export class HealthController {
  @Get('api/health')
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
