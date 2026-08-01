import { Injectable, NotFoundException } from '@nestjs/common';
import { StoreService } from '../common/store.service';

@Injectable()
export class DepartmentsService {
  constructor(private store: StoreService) {}

  getDepartments(companyId: string) {
    return this.store.listDepartments(companyId);
  }

  createDepartment(companyId: string, data: any) {
    return this.store.createDepartment({
      companyId,
      name: data.name,
      description: data.description || null,
      keywords: Array.isArray(data.keywords) ? data.keywords : (data.keywords || '').split(',').map((k: string) => k.trim()).filter(Boolean),
      email: data.email || null,
    });
  }

  async updateDepartment(id: string, data: any) {
    const patch: any = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.description !== undefined) patch.description = data.description;
    if (data.keywords !== undefined) {
      patch.keywords = Array.isArray(data.keywords) ? data.keywords : (data.keywords || '').split(',').map((k: string) => k.trim()).filter(Boolean);
    }
    if (data.email !== undefined) patch.email = data.email;
    const updated = await this.store.updateDepartment(id, patch);
    if (!updated) throw new NotFoundException('Department not found');
    return updated;
  }

  async deleteDepartment(id: string) {
    await this.store.deleteDepartment(id);
    return { success: true };
  }
}
