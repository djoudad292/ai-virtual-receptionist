import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { DatabaseService } from '../common/database.service';

@SkipThrottle({ global: true, strict: true })
@Controller()
export class HealthController {
  constructor(private readonly db: DatabaseService) {}

  @Get('api/health')
  async check() {
    const diag: any = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'pending',
      ai: {
        hasOpenRouterKey: !!process.env.OPENROUTER_API_KEY,
        hasGeminiKey: !!process.env.GEMINI_API_KEY,
        model: process.env.OPENROUTER_MODEL || 'default',
      },
    };
    try {
      await this.db.query('SELECT 1');
      diag.database = 'connected';
    } catch (err) {
      diag.database = 'error';
      diag.dbError = (err as Error).message;
    }
    if (process.env.OPENROUTER_API_KEY) {
      try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          },
          body: JSON.stringify({
            model: process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash',
            messages: [{ role: 'user', content: 'Say OK' }],
            max_tokens: 5,
          }),
        });
        const body = await res.text();
        diag.ai.openRouterProbe = {
          status: res.status,
          snippet: body.slice(0, 300),
        };
      } catch (err) {
        diag.ai.openRouterProbe = { error: (err as Error).message };
      }
    }
    return diag;
  }
}
