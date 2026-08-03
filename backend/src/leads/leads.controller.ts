import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Req } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('leads')
@UseGuards(JwtAuthGuard)
export class LeadsController {
  constructor(private leadsService: LeadsService) {}

  @Get()
  getLeads(@Req() req: any, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.leadsService.getLeads(req.user.companyId, Number(page) || 1, Math.min(Number(limit) || 50, 100));
  }

  @Post()
  createLead(@Req() req: any, @Body() body: any) {
    return this.leadsService.createLead(req.user.companyId, body);
  }

  @Patch(':id/status')
  updateStatus(@Req() req: any, @Param('id') id: string, @Body('status') status: string) {
    return this.leadsService.updateStatus(id, status, req.user.companyId);
  }
}
