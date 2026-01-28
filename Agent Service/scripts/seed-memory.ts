/**
 * Memory System Seed Script
 * 
 * Enables pgvector extension and seeds default memory tags.
 * Run with: npx tsx scripts/seed-memory.ts
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import { memoryTags } from '../src/database/schema';
import { eq } from 'drizzle-orm';

const DEFAULT_TAGS = [
  { name: 'health', description: 'Health-related memories (appointments, symptoms, medications)', color: '#4CAF50' },
  { name: 'goals', description: 'Personal goals, aspirations, and targets', color: '#2196F3' },
  { name: 'food', description: 'Dietary preferences, recipes, and meal plans', color: '#FF9800' },
  { name: 'events', description: 'Calendar events, meetings, and deadlines', color: '#9C27B0' },
  { name: 'people', description: 'Information about contacts and relationships', color: '#E91E63' },
  { name: 'work', description: 'Work-related tasks, projects, and notes', color: '#607D8B' },
  { name: 'finance', description: 'Financial goals, expenses, and reminders', color: '#795548' },
  { name: 'learning', description: 'Things to learn, courses, and skills', color: '#00BCD4' },
  { name: 'personal', description: 'General personal notes and thoughts', color: '#9E9E9E' },
  { name: 'reminder', description: 'Time-sensitive reminders', color: '#F44336' },
];

async function main() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5437/agent_service';
  
  console.log('🔗 Connecting to database...');
  const client = new Client({ connectionString });
  await client.connect();
  
  // Enable pgvector extension
  console.log('📦 Enabling pgvector extension...');
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS vector');
    console.log('   ✅ pgvector extension enabled');
  } catch (error) {
    console.error('   ⚠️ Could not enable pgvector extension:', error);
    console.log('   Make sure you are using the pgvector/pgvector:pg16 Docker image');
  }
  
  const db = drizzle(client);
  
  // Seed default tags
  console.log('🏷️  Seeding default memory tags...');
  for (const tag of DEFAULT_TAGS) {
    try {
      // Check if tag exists
      const existing = await db.select().from(memoryTags).where(eq(memoryTags.name, tag.name)).limit(1);
      
      if (existing.length === 0) {
        await db.insert(memoryTags).values(tag);
        console.log(`   ✅ Created tag: ${tag.name}`);
      } else {
        // Update existing tag with description and color
        await db.update(memoryTags)
          .set({ description: tag.description, color: tag.color })
          .where(eq(memoryTags.name, tag.name));
        console.log(`   🔄 Updated tag: ${tag.name}`);
      }
    } catch (error) {
      console.error(`   ❌ Error with tag ${tag.name}:`, error);
    }
  }
  
  // List all tags
  const allTags = await db.select().from(memoryTags);
  console.log(`\n📋 Total memory tags: ${allTags.length}`);
  allTags.forEach(t => console.log(`   - ${t.name}: ${t.description || '(no description)'}`));
  
  await client.end();
  console.log('\n✨ Memory system seed complete!');
}

main().catch(console.error);
