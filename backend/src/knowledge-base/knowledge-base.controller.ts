import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Req,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { KnowledgeBaseService } from './knowledge-base.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AIService } from '../ai/ai.service';
import { validateUploadedFile, extractFileText } from '../common/upload-rules';

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
  async uploadDocument(@Req() req: any, @UploadedFile() file?: Express.Multer.File) {
    const { isPdf, title } = validateUploadedFile(file);
    const { content, pageCount } = await extractFileText(file!, isPdf);

    return this.kbService.createDocument(req.user.companyId, title, content, {
      filename: file!.originalname,
      mime: file!.mimetype || (isPdf ? 'application/pdf' : 'text/plain'),
      sizeBytes: file!.size,
      data: file!.buffer,
      pageCount,
    });
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

  @Get(':id')
  async getDocument(@Req() req: any, @Param('id') id: string) {
    const doc = await this.kbService.assertDocumentInCompany(id, req.user.companyId);
    const { file, ...rest } = doc;
    return rest;
  }

  @Get(':id/download')
  async download(@Req() req: any, @Param('id') id: string, @Res() res: Response) {
    const doc = await this.kbService.assertDocumentInCompany(id, req.user.companyId);
    if (!doc.file) {
      throw new BadRequestException('The original file is not stored for this document');
    }
    res.setHeader('Content-Type', doc.mime || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(doc.filename || doc.title)}"`,
    );
    res.send(doc.file);
  }

  @Post(':id/ask')
  ask(@Req() req: any, @Param('id') id: string, @Body('question') question: string) {
    return this.kbService.ask(req.user.companyId, id, question);
  }

  @Post(':id/summarize')
  summarize(@Req() req: any, @Param('id') id: string, @Body('force') force?: boolean) {
    return this.kbService.summarize(req.user.companyId, id, force === true);
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body('published') published?: boolean) {
    if (typeof published !== 'boolean') {
      throw new BadRequestException('Only the published flag can be changed');
    }
    return this.kbService.setPublished(id, req.user.companyId, published);
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
