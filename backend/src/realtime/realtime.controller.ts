import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Headers,
  UseGuards,
  Req,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChatService } from '../chat/chat.service';
import { RealtimeService, RealtimeAuth } from './realtime.service';

/**
 * Serverless-safe realtime API (Vercel has no WebSockets).
 * Semantics mirror the socket.io gateway exactly:
 * - guests allowed with matching companyId
 * - agents authenticated via Bearer JWT
 * Clients POST a message (full AI round trip in one call) and poll
 * GET messages?since= for updates from other participants.
 */
@Controller('realtime')
export class RealtimeController {
  constructor(
    private realtime: RealtimeService,
    private chatService: ChatService,
  ) {}

  private authFromHeader(authorization?: string) {
    return this.realtime.resolveAuth(authorization);
  }

  @Post('conversations/:id/messages')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async sendMessage(
    @Param('id') id: string,
    @Body('content') content: string,
    @Body('companyId') companyId?: string,
    @Body('senderType') senderType?: 'user' | 'agent',
    @Headers('authorization') authorization?: string,
  ) {
    if (!content?.trim()) throw new BadRequestException('content is required');
    const auth = await this.authFromHeader(authorization);
    return this.realtime.sendUserMessage(id, content.trim(), { auth, companyId, senderType });
  }

  @Get('conversations/:id/messages')
  async getMessages(
    @Param('id') id: string,
    @Query('since') since?: string,
    @Query('companyId') companyId?: string,
    @Headers('authorization') authorization?: string,
  ) {
    const auth = await this.authFromHeader(authorization);
    await this.realtime.checkAccess(id, auth, companyId);
    const messages = await this.chatService.getMessages(id);
    if (!since) return messages;
    const idx = messages.findIndex((m: any) => String(m.id) === String(since));
    return idx >= 0 ? messages.slice(idx + 1) : messages;
  }

  @Post('conversations/:id/agent-join')
  @UseGuards(JwtAuthGuard)
  async agentJoin(@Param('id') id: string, @Req() req: any) {
    const auth = req.user as RealtimeAuth;
    return this.realtime.agentJoin(id, auth);
  }

  @Post('conversations/:id/takeover')
  @UseGuards(JwtAuthGuard)
  async takeover(@Param('id') id: string, @Req() req: any) {
    const auth = req.user as RealtimeAuth;
    if (!auth.companyId) throw new ForbiddenException('Agent company required');
    return this.realtime.takeover(id, auth);
  }
}
