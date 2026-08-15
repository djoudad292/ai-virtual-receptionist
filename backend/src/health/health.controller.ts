import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

@SkipThrottle({ global: true, strict: true })
@Controller()
export class HealthController {
  @Get('api/health')
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      ai: {
        hasOpenRouterKey: !!process.env.OPENROUTER_API_KEY,
        model: process.env.OPENROUTER_MODEL || 'default',
      },
    };
  }
}
