import { Injectable } from '@nestjs/common';
import { StoreService } from '../common/store.service';

@Injectable()
export class LeadsService {
  constructor(private store: StoreService) {}

  getLeads(companyId: string) {
    return this.store.findLeadsByCompany(companyId);
  }

  async createLead(companyId: string, data: any) {
    return this.store.createLead({
      id: crypto.randomUUID(),
      companyId,
      name: data.name || null,
      email: data.email || null,
      phone: data.phone || null,
      message: data.message || null,
      source: data.source || 'manual',
      status: data.status || 'new',
      department: data.department || null,
    });
  }

  updateStatus(id: string, status: string) {
    return this.store.updateLead(id, { status });
  }
}
