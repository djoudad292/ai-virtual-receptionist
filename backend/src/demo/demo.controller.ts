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
const TITLE_VALUES = new Set(['', 'Mr', 'Mrs', 'Ms', 'Dr', 'Prof']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type IntakeBody = {
  sessionId: unknown;
  title: unknown;
  fullName: unknown;
  phone: unknown;
  email: unknown;
  preferredAt: unknown;
  reason: unknown;
};

function validateIntakeBody(body: unknown): {
  sessionId: string;
  title: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  preferredAt: string | null;
  reason: string | null;
} {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestException('Request body must be an object');
  }
  const b = body as IntakeBody;

  if (typeof b.sessionId !== 'string' || !SESSION_ID_RE.test(b.sessionId)) {
    throw new BadRequestException('Invalid sessionId');
  }

  if (typeof b.fullName !== 'string') {
    throw new BadRequestException('fullName must be a string');
  }
  const fullName = b.fullName.trim();
  if (!fullName || fullName.length > 100) {
    throw new BadRequestException('fullName must be a non-empty string (max 100 characters)');
  }

  if (b.title !== undefined && b.title !== null && typeof b.title !== 'string') {
    throw new BadRequestException('title must be a string');
  }
  const title = typeof b.title === 'string' ? b.title.trim() : '';
  if (!TITLE_VALUES.has(title)) {
    throw new BadRequestException('title must be one of: "", Mr, Mrs, Ms, Dr, Prof');
  }

  if (b.phone !== undefined && b.phone !== null && typeof b.phone !== 'string') {
    throw new BadRequestException('phone must be a string');
  }
  const phone =
    b.phone !== undefined && b.phone !== null && typeof b.phone === 'string'
      ? b.phone.trim()
      : null;
  if (phone !== null && (phone.length === 0 || phone.length > 32)) {
    throw new BadRequestException('phone must be at most 32 characters');
  }

  if (b.email !== undefined && b.email !== null && typeof b.email !== 'string') {
    throw new BadRequestException('email must be a string');
  }
  let email: string | null = null;
  if (b.email !== undefined && b.email !== null && typeof b.email === 'string') {
    const trimmed = b.email.trim();
    if (trimmed.length > 120) {
      throw new BadRequestException('email must be at most 120 characters');
    }
    if (trimmed.length > 0 && !EMAIL_RE.test(trimmed)) {
      throw new BadRequestException('email is invalid');
    }
    email = trimmed.length > 0 ? trimmed : null;
  }

  if (b.preferredAt !== undefined && b.preferredAt !== null && typeof b.preferredAt !== 'string') {
    throw new BadRequestException('preferredAt must be a string');
  }
  let preferredAt: string | null = null;
  if (
    b.preferredAt !== undefined &&
    b.preferredAt !== null &&
    typeof b.preferredAt === 'string'
  ) {
    const trimmed = b.preferredAt.trim();
    if (trimmed.length > 0) {
      const parsed = new Date(trimmed);
      if (isNaN(parsed.getTime())) {
        throw new BadRequestException('preferredAt must be a valid ISO date');
      }
      preferredAt = parsed.toISOString();
    }
  }

  if (b.reason !== undefined && b.reason !== null && typeof b.reason !== 'string') {
    throw new BadRequestException('reason must be a string');
  }
  const reason =
    b.reason !== undefined && b.reason !== null && typeof b.reason === 'string'
      ? b.reason.trim()
      : null;
  if (reason !== null && reason.length > 500) {
    throw new BadRequestException('reason must be at most 500 characters');
  }

  return { sessionId: b.sessionId, title, fullName, phone, email, preferredAt, reason };
}

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

  @Post('intake')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async intake(@Body() body: unknown) {
    const data = validateIntakeBody(body);
    await this.demoService.upsertIntake(data);
    return { saved: true };
  }

  @Get('intake')
  intakeGet(@Query('sessionId') sessionId: unknown) {
    if (typeof sessionId !== 'string' || !SESSION_ID_RE.test(sessionId)) {
      throw new BadRequestException('Invalid sessionId');
    }
    return this.demoService.findIntakeBySession(sessionId);
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

  @Get('leads')
  leads(@Query('sessionId') sessionId?: string) {
    if (sessionId && !SESSION_ID_RE.test(sessionId)) {
      throw new BadRequestException('Invalid sessionId');
    }
    return this.demoService.listLeads(sessionId || undefined);
  }
}
