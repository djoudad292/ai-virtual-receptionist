import { Injectable } from '@nestjs/common';
import { StoreService } from '../common/store.service';

@Injectable()
export class AppointmentsService {
  constructor(private store: StoreService) {}

  getAppointments(companyId: string) {
    return this.store.findAppointmentsByCompany(companyId);
  }

  async createAppointment(companyId: string, data: any) {
    const startTime = data.startTime ? new Date(data.startTime) : null;
    if (!startTime || isNaN(startTime.getTime())) {
      throw new Error('A valid startTime is required');
    }
    const durationMinutes = Number(data.durationMinutes || 30);
    const endTime = data.endTime ? new Date(data.endTime) : new Date(startTime.getTime() + durationMinutes * 60 * 1000);

    return this.store.createAppointment({
      id: crypto.randomUUID(),
      companyId,
      conversationId: data.conversationId || null,
      leadId: data.leadId || null,
      customerName: data.customerName || null,
      customerEmail: data.customerEmail || null,
      title: data.title || 'Scheduled meeting',
      notes: data.notes || null,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      status: data.status || 'confirmed',
    });
  }

  updateStatus(id: string, status: string) {
    return this.store.updateAppointment(id, { status });
  }
}
