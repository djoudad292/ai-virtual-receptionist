import { Injectable } from '@nestjs/common';
import { StoreService } from '../common/store.service';

@Injectable()
export class UsersService {
  constructor(private store: StoreService) {}

  findById(id: string) {
    return this.store.findUserById(id);
  }

  findAll() {
    return this.store.findAllUsers();
  }
}
