import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
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

  async assertLeadInCompany(id: string, companyId: string) {
    const lead = await this.store.findLeadById(id);
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
    if (lead.companyId !== companyId) {
      throw new ForbiddenException('You do not have access to this lead');
    }
    return lead;
  }

  async updateStatus(id: string, status: string, companyId: string) {
    await this.assertLeadInCompany(id, companyId);
    return this.store.updateLead(id, { status });
  }
}
