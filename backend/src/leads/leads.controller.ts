import { Controller, Get, Post, Patch, Param, Body, UseGuards, Req } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('leads')
@UseGuards(JwtAuthGuard)
export class LeadsController {
  constructor(private leadsService: LeadsService) {}

  @Get()
  getLeads(@Req() req: any) {
    return this.leadsService.getLeads(req.user.companyId);
  }

  @Post()
  createLead(@Req() req: any, @Body() body: any) {
    return this.leadsService.createLead(req.user.companyId, body);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.leadsService.updateStatus(id, status);
  }
}
