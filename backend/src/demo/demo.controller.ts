import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { DemoService } from './demo.service';
import { validateUploadedFile, extractFileText } from '../common/upload-rules';

const SESSION_ID_RE = /^[A-Za-z0-9-]{8,64}$/;

@Controller('/demo')
export class DemoController {
  constructor(private readonly demoService: DemoService) {}

  @Post('ask')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async ask(@Body('sessionId') sessionId: string, @Body('question') question: string) {
    if (!sessionId || typeof sessionId !== 'string' || !SESSION_ID_RE.test(sessionId)) {
      throw new BadRequestException('Invalid sessionId');
    }
    const trimmed = typeof question === 'string' ? question.trim() : '';
    if (!trimmed || trimmed.length > 1000) {
      throw new BadRequestException('A non-empty question (max 1000 characters) is required');
    }

    return this.demoService.ask(sessionId, trimmed);
  }

  @Post('upload')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseInterceptors(FileInterceptor('file'))
  async upload(@UploadedFile() file?: Express.Multer.File) {
    const validation = validateUploadedFile(file);
    const extracted = await extractFileText(file!, validation.isPdf);

    return this.demoService.upload(file!, validation, extracted);
  }

  @Get('documents')
  documents() {
    return this.demoService.listDocuments();
  }

  @Get('appointments')
  appointments(@Query('sessionId') sessionId?: string) {
    if (sessionId && !SESSION_ID_RE.test(sessionId)) {
      throw new BadRequestException('Invalid sessionId');
    }
    return this.demoService.listAppointments(sessionId || undefined);
  }
}
