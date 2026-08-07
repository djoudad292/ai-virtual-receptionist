import { Controller, Get, Post, Param, Body, BadRequestException } from '@nestjs/common';
import { StoreService } from '../common/store.service';
import { AIService } from '../ai/ai.service';

const DEFAULT_WIDGET = {
  title: 'Customer Support',
  color: '#3b82f6',
  position: 'right',
};

@Controller('widget')
export class WidgetController {
  constructor(
    private store: StoreService,
    private aiService: AIService,
  ) {}

  @Get(':companyId/config')
  async getConfig(@Param('companyId') companyId: string) {
    const company = await this.store.findCompanyById(companyId);
    const docs = await this.store.findPublishedDocuments(companyId);
    const w = company?.settings?.widget || {};
    return {
      title: w.title || DEFAULT_WIDGET.title,
      color: w.color || DEFAULT_WIDGET.color,
      position: w.position === 'left' ? 'left' : DEFAULT_WIDGET.position,
      documents: docs.map((d) => ({ id: d.id, title: d.title })),
    };
  }

  @Post('ask')
  async ask(@Body('companyId') companyId: string, @Body('question') question: string) {
    if (!companyId || typeof question !== 'string' || !question.trim()) {
      throw new BadRequestException('companyId and question are required');
    }
    const result = await this.aiService.askCompanyPublished(companyId, question.trim());
    return result;
  }
}
