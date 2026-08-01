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
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('conversations')
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  getConversations(@Req() req: any, @Query('status') status?: string) {
    return this.chatService.getConversations(req.user.companyId, status);
  }

  @Get(':id/messages')
  @UseGuards(JwtAuthGuard)
  getMessages(@Param('id') id: string) {
    return this.chatService.getMessages(id);
  }

  @Post()
  createConversation(@Body('companyId') companyId?: string) {
    return this.chatService.createConversation(companyId || 'public');
  }

  @Post(':id/messages')
  sendMessage(
    @Req() req: any,
    @Param('id') id: string,
    @Body('content') content: string,
  ) {
    return this.chatService.sendMessage(id, req.user.id, 'agent', content);
  }

  @Patch(':id/assign')
  async assignAgent(@Req() req: any, @Param('id') id: string, @Body('agentId') agentId?: string) {
    const targetAgentId = agentId || req.user.id;
    return this.chatService.assignAgent(id, targetAgentId);
  }

  @Patch(':id/resolve')
  resolveConversation(@Param('id') id: string) {
    return this.chatService.resolveConversation(id);
  }
}
