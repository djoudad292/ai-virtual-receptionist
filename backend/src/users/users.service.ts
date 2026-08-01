import { Injectable } from '@nestjs/common';
import { StoreService } from '../common/store.service';

@Injectable()
export class UsersService {
  constructor(private store: StoreService) {}

  findByEmail(email: string) {
    return this.store.findUserByEmail(email);
  }

  findById(id: string) {
    return this.store.findUserById(id);
  }

  findAll() {
    return this.store.findAllUsers();
  }

  update(id: string, data: { name?: string; email?: string; role?: string }) {
    return this.store.updateUser(id, data);
  }

  delete(id: string) {
    return this.store.deleteUser(id);
  }
}
