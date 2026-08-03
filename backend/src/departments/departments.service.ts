import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
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

  async assertDepartmentInCompany(id: string, companyId: string) {
    const dept = await this.store.findDepartmentById(id);
    if (!dept) {
      throw new NotFoundException('Department not found');
    }
    if (dept.companyId !== companyId) {
      throw new ForbiddenException('You do not have access to this department');
    }
    return dept;
  }

  async updateDepartment(id: string, data: any, companyId: string) {
    await this.assertDepartmentInCompany(id, companyId);
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

  async deleteDepartment(id: string, companyId: string) {
    await this.assertDepartmentInCompany(id, companyId);
    await this.store.deleteDepartment(id);
    return { success: true };
  }
}
