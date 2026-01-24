import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { getDatabase, closeDatabase, Database } from './index';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private db: Database;

  onModuleInit() {
    this.db = getDatabase();
  }

  async onModuleDestroy() {
    await closeDatabase();
  }

  getDb(): Database {
    return this.db;
  }
}
