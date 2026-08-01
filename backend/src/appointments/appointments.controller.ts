import { Controller, Get, Post, Patch, Param, Body, UseGuards, Req } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('appointments')
@UseGuards(JwtAuthGuard)
export class AppointmentsController {
  constructor(private appointmentsService: AppointmentsService) {}

  @Get()
  getAppointments(@Req() req: any) {
    return this.appointmentsService.getAppointments(req.user.companyId);
  }

  @Post()
  createAppointment(@Req() req: any, @Body() body: any) {
    return this.appointmentsService.createAppointment(req.user.companyId, body);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.appointmentsService.updateStatus(id, status);
  }
}
