import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { StoreService } from '../common/store.service';

@Injectable()
export class ChatService {
  constructor(private store: StoreService) {}

  createConversation(companyId: string) {
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

  async getConversations(companyId: string, status?: string, page = 1, limit = 50) {
    return this.store.findConversationsByCompany(companyId, status, page, limit);
  }

  async assertConversationInCompany(conversationId: string, companyId: string) {
    const conversation = await this.store.findConversationById(conversationId);
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    if (conversation.companyId !== companyId) {
      throw new ForbiddenException('You do not have access to this conversation');
    }
    return conversation;
  }

  getMessages(conversationId: string) {
    return this.store.findMessagesByConversation(conversationId);
  }

  async getMessagesForCompany(conversationId: string, companyId: string) {
    await this.assertConversationInCompany(conversationId, companyId);
    return this.store.findMessagesByConversation(conversationId);
  }

  async assignAgent(conversationId: string, agentId: string, companyId: string) {
    await this.assertConversationInCompany(conversationId, companyId);
    return this.store.updateConversation(conversationId, { assignedAgentId: agentId, status: 'active' });
  }

  escalateConversation(conversationId: string) {
    return this.store.updateConversation(conversationId, { status: 'waiting' });
  }

  async resolveConversation(conversationId: string, companyId: string) {
    await this.assertConversationInCompany(conversationId, companyId);
    return this.store.updateConversation(conversationId, { status: 'resolved' });
  }

  async sendMessageToConversation(
    conversationId: string,
    senderId: string,
    senderType: string,
    content: string,
    companyId: string,
  ) {
    await this.assertConversationInCompany(conversationId, companyId);
    return this.store.createMessage({
      id: crypto.randomUUID(),
      conversationId,
      senderId,
      senderType,
      content,
    });
  }

  async getConversationCompanyId(conversationId: string): Promise<string> {
    const conversation = await this.store.findConversationById(conversationId);
    return conversation?.companyId || '';
  }

  async findCompanyOrThrow(companyId: string) {
    const company = await this.store.findCompanyById(companyId);
    if (!company) {
      throw new NotFoundException('Company not found');
    }
    return company;
  }
}
