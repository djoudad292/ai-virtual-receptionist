import { Injectable } from '@nestjs/common';
import { StoreService } from '../common/store.service';

@Injectable()
export class CompaniesService {
  constructor(private store: StoreService) {}

  getCompany(id: string) {
    return this.store.findCompanyById(id);
  }

  updateSettings(id: string, settings: Record<string, any>) {
    return this.store.updateCompanySettings(id, settings);
  }
}
