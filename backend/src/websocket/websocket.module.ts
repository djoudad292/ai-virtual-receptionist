import { Module } from '@nestjs/common';
import { WebSocketGateway } from './websocket.gateway';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [RealtimeModule],
  providers: [WebSocketGateway],
})
export class WebSocketModule {}
