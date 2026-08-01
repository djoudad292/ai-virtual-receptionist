import { Module } from '@nestjs/common';
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
import { AnalyticsController } from './analytics/analytics.controller';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
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
  ],
  controllers: [HealthController, AnalyticsController],
})
export class AppModule {}
