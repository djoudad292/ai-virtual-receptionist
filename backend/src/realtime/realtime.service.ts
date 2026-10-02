import { Injectable, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from '../chat/chat.service';
import { AIService } from '../ai/ai.service';
import { StoreService } from '../common/store.service';
import { JWT_SECRET } from '../common/config';

export interface RealtimeAuth {
  id: string;
  email: string;
  role: string;
  companyId?: string;
}

/**
 * Shared message+AI flow used by BOTH the socket.io gateway (Render) and the
 * REST realtime controller (Vercel serverless, no WebSockets). One source of
 * truth — the transports only differ in how results are delivered.
 */
@Injectable()
export class RealtimeService {
  constructor(
    private jwtService: JwtService,
    private chatService: ChatService,
    private aiService: AIService,
    private store: StoreService,
  ) {}

  /** Mirrors gateway auth: token optional, guests allowed. */
  async resolveAuth(authHeader?: string): Promise<RealtimeAuth | null> {
    const token = authHeader?.replace('Bearer ', '');
    if (!token) return null;
    try {
      const payload = this.jwtService.verify(token, { secret: JWT_SECRET() });
      const user = await this.store.findUserById(payload.sub);
      if (!user || payload.ver !== user.tokenVersion) return null;
      return { id: payload.sub, email: payload.email, role: payload.role, companyId: payload.companyId };
    } catch {
      return null;
    }
  }

  /** Returns the conversation's company or throws Forbidden. */
  async checkAccess(conversationId: string, auth: RealtimeAuth | null, companyId?: string): Promise<string> {
    const conversationCompany = await this.chatService.getConversationCompanyId(conversationId);
    if (!conversationCompany) throw new ForbiddenException('Unknown conversation');
    if (auth?.companyId) {
      if (auth.companyId !== conversationCompany) {
        throw new ForbiddenException('Conversation belongs to another company');
      }
    } else if (companyId !== conversationCompany) {
      throw new ForbiddenException('Invalid company for conversation');
    }
    return conversationCompany;
  }

  /**
   * Full user-message flow: persist → AI → persist answer → escalate if needed.
   * Returns the same payload shape the gateway used to emit.
   */
  async sendUserMessage(
    conversationId: string,
    content: string,
    opts: { auth?: RealtimeAuth | null; companyId?: string; senderType?: 'user' | 'agent'; mode?: 'receptionist' | 'support' } = {},
  ) {
    const { auth = null, companyId, senderType: overrideType, mode } = opts;
    const company = await this.checkAccess(conversationId, auth, companyId);

    const isAgent = auth?.role === 'AGENT' || auth?.role === 'COMPANY_ADMIN';
    const senderType = overrideType || (isAgent ? 'agent' : 'user');

    const userMessage = await this.chatService.sendMessage(
      conversationId,
      auth?.id || null,
      senderType,
      content,
    );

    // Agent messages stop here — no AI reply.
    if (senderType !== 'user') {
      return { userMessage, aiMessage: null, ai: null, escalated: false };
    }

    const history = await this.chatService.getMessages(conversationId);
    let aiResponse;
    try {
      aiResponse = await this.aiService.generateResponse(
        auth?.companyId || company,
        content,
        history,
        conversationId,
        { mode: mode || (auth ? 'support' : 'receptionist') },
      );
    } catch (err) {
      console.error('AI response failed:', (err as Error).message);
      const errorMessage = await this.chatService.sendMessage(
        conversationId,
        null,
        'system',
        'Sorry, the AI service is having trouble. A human agent will be with you shortly.',
      );
      return {
        userMessage,
        aiMessage: errorMessage,
        ai: { source: 'escalate', confidence: 0 },
        escalated: true,
      };
    }

    const aiMessage = await this.chatService.sendMessage(
      conversationId,
      null,
      aiResponse.source === 'escalate' ? 'system' : 'ai',
      aiResponse.response,
      {
        sources: aiResponse.sources || [],
        intent: aiResponse.intent,
        confidence: aiResponse.confidence,
        department: aiResponse.department,
        source: aiResponse.source,
        lead: aiResponse.lead,
        appointment: aiResponse.appointment,
        retrievalMode: aiResponse.retrievalMode || 'vector',
        steps: aiResponse.steps || [],
      },
    );

    let escalated = false;
    if (aiResponse.source === 'escalate') {
      await this.chatService.escalateConversation(conversationId);
      await this.chatService.sendMessage(
        conversationId,
        null,
        'system',
        'This conversation has been escalated to a human agent.',
      );
      escalated = true;
    }

    return {
      userMessage,
      aiMessage,
      ai: {
        source: aiResponse.source,
        confidence: aiResponse.confidence,
        intent: aiResponse.intent,
        department: aiResponse.department,
        lead: aiResponse.lead,
        appointment: aiResponse.appointment,
        sources: aiResponse.sources || [],
        retrievalMode: aiResponse.retrievalMode || 'vector',
        steps: aiResponse.steps || [],
      },
      escalated,
    };
  }

  async agentJoin(conversationId: string, auth: RealtimeAuth) {
    await this.checkAccess(conversationId, auth);
    return this.chatService.sendMessage(
      conversationId,
      auth.id,
      'agent',
      'An agent has joined the conversation.',
    );
  }

  async takeover(conversationId: string, auth: RealtimeAuth) {
    const company = await this.checkAccess(conversationId, auth);
    const agent = await this.chatService.assignAgent(conversationId, auth.id, auth.companyId || company);
    const message = await this.chatService.sendMessage(
      conversationId,
      null,
      'system',
      'An agent has taken over this conversation.',
    );
    return { agent, message };
  }
}
