import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('conversations')
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  getConversations(@Req() req: any, @Query('status') status?: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.chatService.getConversations(
      req.user.companyId,
      status,
      Number(page) || 1,
      Math.min(Number(limit) || 50, 100),
    );
  }

  @Get(':id/messages')
  @UseGuards(JwtAuthGuard)
  getMessages(@Req() req: any, @Param('id') id: string) {
    return this.chatService.getMessagesForCompany(id, req.user.companyId);
  }

  @Post()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async createConversation(@Body('companyId') companyId?: string) {
    if (!companyId) {
      throw new ForbiddenException('A valid companyId is required');
    }
    const company = await this.chatService.findCompanyOrThrow(companyId);
    return this.chatService.createConversation(company.id);
  }

  @Post(':id/messages')
  sendMessage(
    @Req() req: any,
    @Param('id') id: string,
    @Body('content') content: string,
  ) {
    return this.chatService.sendMessageToConversation(
      id,
      req.user.id,
      'agent',
      content,
      req.user.companyId,
    );
  }

  @Patch(':id/assign')
  async assignAgent(@Req() req: any, @Param('id') id: string, @Body('agentId') agentId?: string) {
    const targetAgentId = agentId || req.user.id;
    return this.chatService.assignAgent(id, targetAgentId, req.user.companyId);
  }

  @Patch(':id/resolve')
  @UseGuards(JwtAuthGuard)
  resolveConversation(@Req() req: any, @Param('id') id: string) {
    return this.chatService.resolveConversation(id, req.user.companyId);
  }
}
