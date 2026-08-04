import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

@SkipThrottle({ global: true, strict: true })
@Controller()
export class HealthController {
  @Get('api/health')
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
