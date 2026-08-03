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
    const { items } = await this.store.findConversationsByCompany(companyId, undefined, 1, 1000);
    const conversations = items;
    const total = conversations.length;
    const active = conversations.filter((c) => c.status === 'active').length;
    const aiHandled = conversations.filter((c) => c.handledBy === 'ai').length;
    const humanHandled = conversations.filter((c) => c.handledBy === 'agent').length;
    const unresolved = conversations.filter((c) => c.status !== 'resolved').length;
    const leads = await this.store.countLeads(companyId);
    const appointments = await this.store.countAppointments(companyId);

    return { total, active, aiHandled, humanHandled, unresolved, leads, appointments };
  }

  @Get('detail')
  async detail(@Req() req: any) {
    const companyId = req.user.companyId;

    // Conversations per day (last 14 days)
    const convRows = await this.store.getRaw<{ day: string; count: number }>(
      `SELECT to_char(created_at, 'YYYY-MM-DD') AS day, count(*)::int AS count
       FROM conversations WHERE company_id = $1 AND created_at > now() - interval '14 days'
       GROUP BY day ORDER BY day ASC`,
      [companyId],
    );

    // Leads per day (last 14 days)
    const leadRows = await this.store.getRaw<{ day: string; count: number }>(
      `SELECT to_char(created_at, 'YYYY-MM-DD') AS day, count(*)::int AS count
       FROM leads WHERE company_id = $1 AND created_at > now() - interval '14 days'
       GROUP BY day ORDER BY day ASC`,
      [companyId],
    );

    // Leads by department
    const deptRows = await this.store.getRaw<{ name: string; count: number }>(
      `SELECT COALESCE(department, 'Unassigned') AS name, count(*)::int AS count
       FROM leads WHERE company_id = $1 GROUP BY department`,
      [companyId],
    );

    const fill = (rows: { day: string; count: number }[]): { day: string; count: number }[] => {
      const byDay: Record<string, number> = {};
      rows.forEach((r) => (byDay[r.day] = r.count));
      const days: { day: string; count: number }[] = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        days.push({ day: key, count: byDay[key] || 0 });
      }
      return days;
    };

    return {
      conversationsByDay: fill(convRows),
      leadsByDay: fill(leadRows),
      leadsByDepartment: deptRows,
    };
  }
}
