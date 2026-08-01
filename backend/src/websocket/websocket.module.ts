import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { WebSocketGateway } from './websocket.gateway';
import { ChatModule } from '../chat/chat.module';
import { AIModule } from '../ai/ai.module';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'super-secret-key-change-in-production',
      signOptions: { expiresIn: '15m' },
    }),
    ChatModule,
    AIModule,
  ],
  providers: [WebSocketGateway],
})
export class WebSocketModule {}
