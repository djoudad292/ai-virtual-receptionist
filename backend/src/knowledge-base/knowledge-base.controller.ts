import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { KnowledgeBaseService } from './knowledge-base.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AIService } from '../ai/ai.service';

@Controller('knowledge-base')
@UseGuards(JwtAuthGuard)
export class KnowledgeBaseController {
  constructor(
    private kbService: KnowledgeBaseService,
    private aiService: AIService,
  ) {}

  @Post()
  createDocument(
    @Req() req: any,
    @Body('title') title: string,
    @Body('content') content: string,
  ) {
    return this.kbService.createDocument(req.user.companyId, title, content);
  }

  @Get()
  getDocuments(@Req() req: any) {
    return this.kbService.getDocuments(req.user.companyId);
  }

  @Delete(':id')
  deleteDocument(@Param('id') id: string) {
    return this.kbService.deleteDocument(id);
  }

  @Post(':id/reindex')
  reindexDocument(@Param('id') id: string) {
    return this.kbService.reindexDocument(id);
  }

  @Post('search')
  searchKB(@Req() req: any, @Body('query') query: string) {
    return this.aiService.searchKnowledgeBase(req.user.companyId, query);
  }
}
