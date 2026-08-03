import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { KnowledgeBaseService } from './knowledge-base.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AIService } from '../ai/ai.service';

const MAX_FILE_BYTES = 2 * 1024 * 1024;

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

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadDocument(@Req() req: any, @UploadedFile() file?: Express.Multer.File) {
    if (!file || !file.buffer) {
      throw new BadRequestException('No file uploaded');
    }
    const ext = file.originalname.split('.').pop()?.toLowerCase() || '';
    if (!['txt', 'md', 'markdown'].includes(ext)) {
      throw new BadRequestException('Only .txt, .md and .markdown files are supported');
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new BadRequestException('File must be under 2MB');
    }
    const title = file.originalname.replace(/\.(txt|md|markdown)$/i, '');
    const content = file.buffer.toString('utf8').trim();
    if (!content) {
      throw new BadRequestException('File is empty');
    }
    return this.kbService.createDocument(req.user.companyId, title, content);
  }

  @Get()
  getDocuments(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.kbService.getDocuments(
      req.user.companyId,
      Number(page) || 1,
      Math.min(Number(limit) || 50, 100),
    );
  }

  @Delete(':id')
  deleteDocument(@Req() req: any, @Param('id') id: string) {
    return this.kbService.deleteDocument(id, req.user.companyId);
  }

  @Post(':id/reindex')
  reindexDocument(@Req() req: any, @Param('id') id: string) {
    return this.kbService.reindexDocument(id, req.user.companyId);
  }

  @Post('search')
  searchKB(@Req() req: any, @Body('query') query: string) {
    return this.aiService.searchKnowledgeBase(req.user.companyId, query);
  }
}
