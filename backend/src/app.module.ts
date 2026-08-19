import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CompaniesModule } from './companies/companies.module';
import { ChatModule } from './chat/chat.module';
import { AIModule } from './ai/ai.module';
import { KnowledgeBaseModule } from './knowledge-base/knowledge-base.module';
import { AgentsModule } from './agents/agents.module';
import { WebSocketModule } from './websocket/websocket.module';
import { DatabaseModule } from './common/database.module';
import { LeadsModule } from './leads/leads.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { DepartmentsModule } from './departments/departments.module';
import { WidgetModule } from './widget/widget.module';
import { AnalyticsController } from './analytics/analytics.controller';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'global',
        ttl: 60000,
        limit: 120,
      },
      {
        name: 'strict',
        ttl: 60000,
        limit: 10,
      },
    ]),
    DatabaseModule,
    AuthModule,
    UsersModule,
    CompaniesModule,
    ChatModule,
    AIModule,
    KnowledgeBaseModule,
    AgentsModule,
    LeadsModule,
    AppointmentsModule,
    DepartmentsModule,
    WebSocketModule,
    WidgetModule,
  ],
  controllers: [HealthController, AnalyticsController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
