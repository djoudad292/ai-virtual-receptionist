import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Req } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('appointments')
@UseGuards(JwtAuthGuard)
export class AppointmentsController {
  constructor(private appointmentsService: AppointmentsService) {}

  @Get()
  getAppointments(@Req() req: any, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.appointmentsService.getAppointments(req.user.companyId, Number(page) || 1, Math.min(Number(limit) || 50, 100));
  }

  @Post()
  createAppointment(@Req() req: any, @Body() body: any) {
    return this.appointmentsService.createAppointment(req.user.companyId, body);
  }

  @Patch(':id/status')
  updateStatus(@Req() req: any, @Param('id') id: string, @Body('status') status: string) {
    return this.appointmentsService.updateStatus(id, status, req.user.companyId);
  }
}
