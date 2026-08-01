import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { StoreService } from '../common/store.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private store: StoreService) {}

  @Get('summary')
  async summary(@Req() req: any) {
    const companyId = req.user.companyId;
    const conversations = await this.store.findConversationsByCompany(companyId);
    const total = conversations.length;
    const active = conversations.filter((c) => c.status === 'active').length;
    const aiHandled = conversations.filter((c) => c.handledBy === 'ai').length;
    const humanHandled = conversations.filter((c) => c.handledBy === 'agent').length;
    const unresolved = conversations.filter((c) => c.status !== 'resolved').length;
    const leads = await this.store.countLeads(companyId);
    const appointments = await this.store.countAppointments(companyId);

    return { total, active, aiHandled, humanHandled, unresolved, leads, appointments };
  }
}
