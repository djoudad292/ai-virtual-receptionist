import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { AIService } from './ai.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AIController {
  constructor(private aiService: AIService) {}

  @Post('query')
  async query(@Req() req: any, @Body() body: { message: string; conversationId?: string }) {
    const result = await this.aiService.generateResponse(
      req.user.companyId,
      body.message,
      undefined,
      body.conversationId,
    );
    return {
      response: result.response,
      source: result.source,
      confidence: result.confidence,
      intent: result.intent,
      department: result.department,
      lead: result.lead,
      appointment: result.appointment,
    };
  }

  @Post('search')
  async search(@Req() req: any, @Body('query') query: string) {
    return this.aiService.searchKnowledgeBase(req.user.companyId, query);
  }
}
