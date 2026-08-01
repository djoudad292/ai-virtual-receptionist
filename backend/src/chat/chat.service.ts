import { Injectable, NotFoundException } from '@nestjs/common';
import { StoreService } from '../common/store.service';

@Injectable()
export class ChatService {
  constructor(private store: StoreService) {}

  createConversation(companyId: string, userId?: string) {
    return this.store.createConversation({
      id: crypto.randomUUID(),
      companyId,
      title: 'New Conversation',
      status: 'active',
    });
  }

  sendMessage(
    conversationId: string,
    senderId: string | null,
    senderType: string,
    content: string,
  ) {
    const conversation = this.store.findConversationById(conversationId);
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return this.store.createMessage({
      id: crypto.randomUUID(),
      conversationId,
      senderId: senderId || undefined,
      senderType,
      content,
    });
  }

  async getConversations(companyId: string, status?: string) {
    return this.store.findConversationsByCompany(companyId, status);
  }

  getMessages(conversationId: string) {
    return this.store.findMessagesByConversation(conversationId);
  }

  assignAgent(conversationId: string, agentId: string) {
    return this.store.updateConversation(conversationId, { assignedAgentId: agentId, status: 'active' });
  }

  escalateConversation(conversationId: string) {
    return this.store.updateConversation(conversationId, { status: 'waiting' });
  }

  resolveConversation(conversationId: string) {
    return this.store.updateConversation(conversationId, { status: 'resolved' });
  }

  async getConversationCompanyId(conversationId: string): Promise<string> {
    const conversation = await this.store.findConversationById(conversationId);
    return conversation?.companyId || '';
  }
}
