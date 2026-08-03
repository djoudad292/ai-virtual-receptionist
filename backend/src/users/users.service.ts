import { Injectable } from '@nestjs/common';
import { StoreService } from '../common/store.service';

export type SafeUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  companyId?: string;
  createdAt: Date;
  updatedAt: Date;
};

function safe(user: any): SafeUser {
  if (!user) return user;
  const { password, ...rest } = user;
  return rest as SafeUser;
}

@Injectable()
export class UsersService {
  constructor(private store: StoreService) {}

  async findById(id: string) {
    return safe(await this.store.findUserById(id));
  }

  async findByCompany(companyId: string) {
    const all = await this.store.findAllUsers();
    return all.filter((u) => u.companyId === companyId).map(safe);
  }
}
