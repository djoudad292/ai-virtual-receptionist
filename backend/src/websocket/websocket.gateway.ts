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
import { RealtimeService, RealtimeAuth } from '../realtime/realtime.service';

interface AuthenticatedSocket extends Socket {
  user?: RealtimeAuth;
}

/**
 * Thin transport over RealtimeService — same flow as the REST realtime
 * controller used on Vercel. Keep event names/contract unchanged so the
 * existing frontend keeps working against long-lived hosts.
 */
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

  constructor(private realtime: RealtimeService) {}

  async handleConnection(client: AuthenticatedSocket) {
    const token =
      client.handshake.auth?.token ||
      client.handshake.query?.token ||
      client.handshake.headers?.authorization?.replace('Bearer ', '');

    const user = token
      ? await this.realtime.resolveAuth(`Bearer ${token}`)
      : null;

    if (user) {
      client.user = user;
      if (user.companyId) client.join(`company:${user.companyId}`);
    }

    client.emit('connected', { userId: user?.id || client.id });
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
    try {
      await this.realtime.checkAccess(data.conversationId, client.user || null, data.companyId);
    } catch {
      client.emit('error', { message: 'Forbidden: conversation access denied' });
      return;
    }
    client.join(`conversation:${data.conversationId}`);
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string; content: string; companyId?: string; senderType?: 'user' | 'agent' },
  ) {
    if (!data?.conversationId || !data?.content) return;

    const room = this.server.to(`conversation:${data.conversationId}`);

    try {
      if (data.senderType !== 'agent') room.emit('aiThinking', { isThinking: true });

      const result = await this.realtime.sendUserMessage(data.conversationId, data.content, {
        auth: client.user || null,
        companyId: data.companyId,
        senderType: data.senderType,
      });

      room.emit('newMessage', result.userMessage);

      if (result.aiMessage && data.senderType !== 'agent') {
        room.emit('aiThinking', { isThinking: false });
        room.emit('aiResponse', {
          message: result.aiMessage,
          ...result.ai,
        });
      }
    } catch (err) {
      client.emit('error', { message: (err as Error).message || 'Failed to send message' });
      room.emit('aiThinking', { isThinking: false });
    }
  }

  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string; isTyping: boolean },
  ) {
    if (!data?.conversationId) return;
    client.to(`conversation:${data.conversationId}`).emit('typing', {
      userId: client.user?.id || client.id,
      isTyping: data.isTyping,
    });
  }

  @SubscribeMessage('aiTalk')
  async handleAiTalk(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string; content: string },
  ) {
    if (!data?.conversationId || !data?.content || !client.user) return;

    const room = this.server.to(`conversation:${data.conversationId}`);
    try {
      room.emit('aiThinking', { isThinking: true });
      const result = await this.realtime.sendUserMessage(data.conversationId, data.content, {
        auth: client.user,
        mode: 'support',
      });
      room.emit('newMessage', result.userMessage);
      room.emit('aiThinking', { isThinking: false });
      if (result.aiMessage) {
        room.emit('aiResponse', { message: result.aiMessage, ...result.ai });
      }
    } catch (err) {
      client.emit('error', { message: (err as Error).message || 'AI talk failed' });
      room.emit('aiThinking', { isThinking: false });
    }
  }

  @SubscribeMessage('agentJoin')
  async handleAgentJoin(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!data?.conversationId || !client.user) return;
    try {
      await this.realtime.agentJoin(data.conversationId, client.user);
    } catch (err) {
      client.emit('error', { message: (err as Error).message });
    }
  }

  @SubscribeMessage('takeover')
  async handleTakeover(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!data?.conversationId || !client.user) return;
    try {
      const result = await this.realtime.takeover(data.conversationId, client.user);
      this.server
        .to(`conversation:${data.conversationId}`)
        .emit('takeover', result);
    } catch (err) {
      client.emit('error', { message: (err as Error).message });
    }
  }
}
