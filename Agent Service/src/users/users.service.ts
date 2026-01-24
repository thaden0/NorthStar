import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { users, User, NewUser } from '../database/schema';
import { eq } from 'drizzle-orm';
import { CreateUser, UpdateUser } from '../agent/schemas';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private databaseService: DatabaseService) {}

  async findAll(): Promise<User[]> {
    const db = this.databaseService.getDb();
    return db.select().from(users);
  }

  async findOne(id: string): Promise<User> {
    const db = this.databaseService.getDb();
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    const db = this.databaseService.getDb();
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return user || null;
  }

  async create(data: CreateUser): Promise<User> {
    const db = this.databaseService.getDb();

    // Check if user already exists
    const existing = await db.select().from(users).where(eq(users.id, data.id)).limit(1);
    if (existing.length > 0) {
      throw new ConflictException(`User with ID ${data.id} already exists`);
    }

    const [user] = await db
      .insert(users)
      .values({
        id: data.id,
        email: data.email,
        name: data.name,
        metadata: data.metadata,
      })
      .returning();

    this.logger.log(`Created user: ${user.id}`);
    return user;
  }

  async update(id: string, data: UpdateUser): Promise<User> {
    const db = this.databaseService.getDb();

    // Ensure user exists
    await this.findOne(id);

    const [updated] = await db
      .update(users)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    this.logger.log(`Updated user: ${id}`);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const db = this.databaseService.getDb();

    // Ensure user exists
    await this.findOne(id);

    await db.delete(users).where(eq(users.id, id));
    this.logger.log(`Deleted user: ${id}`);
  }

  async upsert(data: CreateUser): Promise<User> {
    const db = this.databaseService.getDb();

    const [user] = await db
      .insert(users)
      .values({
        id: data.id,
        email: data.email,
        name: data.name,
        metadata: data.metadata,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: data.email,
          name: data.name,
          metadata: data.metadata,
          updatedAt: new Date(),
        },
      })
      .returning();

    return user;
  }
}
