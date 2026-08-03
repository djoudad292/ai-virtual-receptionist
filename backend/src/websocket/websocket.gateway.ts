import {
  WebSocketGateway as WsGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from '../chat/chat.service';
import { AIService } from '../ai/ai.service';
import { JWT_SECRET } from '../common/config';

interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    email: string;
    role: string;
    companyId?: string;
  };
}

@WsGateway({
  cors: {
    origin: '*',
  },
  namespace: '/',
})
export class WebSocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
    private jwtService: JwtService,
    private chatService: ChatService,
    private aiService: AIService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    const token =
      client.handshake.auth?.token ||
      client.handshake.query?.token ||
      client.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      client.emit('connected', { userId: client.id });
      return;
    }

    try {
      const payload = this.jwtService.verify(token, {
        secret: JWT_SECRET(),
      });

      client.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        companyId: payload.companyId,
      };

      if (client.user.companyId) {
        client.join(`company:${client.user.companyId}`);
      }

      client.emit('connected', { userId: client.user.id });
    } catch {
      client.emit('connected', { userId: client.id });
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.user?.companyId) {
      client.leave(`company:${client.user.companyId}`);
    }
  }

  @SubscribeMessage('joinConversation')
  async handleJoinConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string; companyId?: string },
  ) {
    if (!data?.conversationId) return;

    const conversationCompany = await this.chatService.getConversationCompanyId(data.conversationId);
    if (!conversationCompany) return;

    if (client.user?.companyId) {
      if (client.user.companyId !== conversationCompany) {
        client.emit('error', { message: 'Forbidden: conversation belongs to another company' });
        return;
      }
    } else if (data.companyId !== conversationCompany) {
      client.emit('error', { message: 'Forbidden: invalid company for conversation' });
      return;
    }

    client.join(`conversation:${data.conversationId}`);
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string; content: string; companyId?: string },
  ) {
    if (!data?.conversationId || !data?.content) return;

    const conversationCompany = await this.chatService.getConversationCompanyId(data.conversationId);
    if (!conversationCompany) return;

    if (client.user?.companyId) {
      if (client.user.companyId !== conversationCompany) {
        client.emit('error', { message: 'Forbidden: conversation belongs to another company' });
        return;
      }
    } else if (data.companyId !== conversationCompany) {
      client.emit('error', { message: 'Forbidden: invalid company for conversation' });
      return;
    }

    const senderId = client.user?.id || null;
    const isAgent = client.user?.role === 'AGENT' || client.user?.role === 'COMPANY_ADMIN';
    const senderType = isAgent ? 'agent' : 'user';

    const message = await this.chatService.sendMessage(
      data.conversationId,
      senderId,
      senderType,
      data.content,
    );

    this.server
      .to(`conversation:${data.conversationId}`)
      .emit('newMessage', message);

    if (!isAgent) {
      this.server
        .to(`conversation:${data.conversationId}`)
        .emit('aiThinking', { isThinking: true });

      try {
        const companyId =
          client.user?.companyId ||
          (await this.chatService.getConversationCompanyId(data.conversationId));

        const history = await this.chatService.getMessages(data.conversationId);
        const aiResponse = await this.aiService.generateResponse(
          companyId,
          data.content,
          history,
          data.conversationId,
        );

        this.server
          .to(`conversation:${data.conversationId}`)
          .emit('aiThinking', { isThinking: false });

        const aiMessage = await this.chatService.sendMessage(
          data.conversationId,
          null,
          aiResponse.source === 'escalate' ? 'system' : 'ai',
          aiResponse.response,
        );

        this.server
          .to(`conversation:${data.conversationId}`)
          .emit('aiResponse', {
            message: aiMessage,
            source: aiResponse.source,
            confidence: aiResponse.confidence,
            intent: aiResponse.intent,
            department: aiResponse.department,
            lead: aiResponse.lead,
            appointment: aiResponse.appointment,
          });

        if (aiResponse.source === 'escalate') {
          await this.chatService.escalateConversation(data.conversationId);
          await this.chatService.sendMessage(
            data.conversationId,
            null,
            'system',
            'This conversation has been escalated to a human agent.',
          );
        }
      } catch (err) {
        console.error('AI response failed:', (err as Error).message);
        this.server
          .to(`conversation:${data.conversationId}`)
          .emit('aiThinking', { isThinking: false });

        const errorMessage = await this.chatService.sendMessage(
          data.conversationId,
          null,
          'system',
          'Sorry, the AI service is having trouble. A human agent will be with you shortly.',
        );

        this.server
          .to(`conversation:${data.conversationId}`)
          .emit('aiResponse', {
            message: errorMessage,
            source: 'escalate',
            confidence: 0,
          });
      }
    }
  }

  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string; isTyping: boolean },
  ) {
    if (!data?.conversationId) return;

    client
      .to(`conversation:${data.conversationId}`)
      .emit('typing', {
        userId: client.user?.id || client.id,
        isTyping: data.isTyping,
      });
  }

  @SubscribeMessage('agentJoin')
  async handleAgentJoin(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!data?.conversationId || !client.user) return;

    const conversationCompany = await this.chatService.getConversationCompanyId(data.conversationId);
    if (!conversationCompany || conversationCompany !== client.user.companyId) {
      client.emit('error', { message: 'Forbidden: conversation belongs to another company' });
      return;
    }

    await this.chatService.sendMessage(
      data.conversationId,
      client.user.id,
      'agent',
      'An agent has joined the conversation.',
    );
  }

  @SubscribeMessage('takeover')
  async handleTakeover(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!data?.conversationId || !client.user) return;

    const conversationCompany = await this.chatService.getConversationCompanyId(data.conversationId);
    if (!conversationCompany || conversationCompany !== client.user.companyId) {
      client.emit('error', { message: 'Forbidden: conversation belongs to another company' });
      return;
    }

    const agent = await this.chatService.assignAgent(
      data.conversationId,
      client.user.id,
      client.user.companyId,
    );

    const systemMessage = await this.chatService.sendMessage(
      data.conversationId,
      null,
      'system',
      'An agent has taken over this conversation.',
    );

    this.server
      .to(`conversation:${data.conversationId}`)
      .emit('takeover', {
        agent: agent,
        message: systemMessage,
      });
  }
}
