import { pgTable, text, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';

// Store Google OAuth tokens for each North Star user
// Supports multiple Google accounts per user
export const googleTokens = pgTable('google_tokens', {
  id: text('id').primaryKey(), // UUID
  userId: text('user_id').notNull(), // North Star user ID (allows multiple accounts)
  email: text('email').notNull(), // Google account email
  displayName: text('display_name'), // User's display name from Google
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  tokenType: text('token_type').default('Bearer'),
  expiresAt: timestamp('expires_at'),
  scope: text('scope'),
  isActive: boolean('is_active').default(true),
  isDefault: boolean('is_default').default(false), // Primary account for the user
  lastSyncAt: timestamp('last_sync_at'),
  syncError: text('sync_error'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Cache for Gmail threads/messages
export const gmailCache = pgTable('gmail_cache', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  accountEmail: text('account_email').notNull(), // Which Google account this belongs to
  messageId: text('message_id').notNull(),
  threadId: text('thread_id'),
  from: text('from'),
  to: text('to'),
  subject: text('subject'),
  snippet: text('snippet'),
  body: text('body'),
  bodyHtml: text('body_html'),
  date: timestamp('date'),
  labelIds: jsonb('label_ids').$type<string[]>(),
  isRead: boolean('is_read').default(false),
  isStarred: boolean('is_starred').default(false),
  cachedAt: timestamp('cached_at').defaultNow(),
});

// Cache for calendar events
export const calendarCache = pgTable('calendar_cache', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  accountEmail: text('account_email').notNull(), // Which Google account this belongs to
  eventId: text('event_id').notNull(),
  calendarId: text('calendar_id').default('primary'),
  title: text('title'),
  description: text('description'),
  location: text('location'),
  start: timestamp('start'),
  end: timestamp('end'),
  allDay: boolean('all_day').default(false),
  status: text('status'), // confirmed, tentative, cancelled
  htmlLink: text('html_link'),
  attendees: jsonb('attendees').$type<Array<{ email: string; name?: string; responseStatus?: string }>>(),
  cachedAt: timestamp('cached_at').defaultNow(),
});

// Cache for contacts
export const contactsCache = pgTable('contacts_cache', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  accountEmail: text('account_email').notNull(), // Which Google account this belongs to
  resourceName: text('resource_name').notNull(),
  name: text('name'),
  givenName: text('given_name'),
  familyName: text('family_name'),
  email: text('email'),
  phone: text('phone'),
  photoUrl: text('photo_url'),
  organization: text('organization'),
  jobTitle: text('job_title'),
  cachedAt: timestamp('cached_at').defaultNow(),
});

// Export all tables
export type GoogleToken = typeof googleTokens.$inferSelect;
export type NewGoogleToken = typeof googleTokens.$inferInsert;
export type GmailMessage = typeof gmailCache.$inferSelect;
export type NewGmailMessage = typeof gmailCache.$inferInsert;
export type CalendarEvent = typeof calendarCache.$inferSelect;
export type NewCalendarEvent = typeof calendarCache.$inferInsert;
export type Contact = typeof contactsCache.$inferSelect;
export type NewContact = typeof contactsCache.$inferInsert;
