import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { StoreService } from './store.service';

@Global()
@Module({
  providers: [DatabaseService, StoreService],
  exports: [DatabaseService, StoreService],
})
export class DatabaseModule {}
