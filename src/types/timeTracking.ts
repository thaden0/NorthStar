// Client Types
export interface Client {
  id: string;
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  hourlyRate: number;
  color: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  projects?: ClientProject[];
}

export interface ClientProject {
  id: string;
  clientId: string;
  name: string;
  description: string | null;
  hourlyRate: number | null;
  color: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  client?: Client;
}

// Time Entry Types
export interface TimeEntry {
  id: string;
  userId: string;
  clientId: string | null;
  projectId: string | null;
  startTimeUtc: Date;
  endTimeUtc: Date;
  description: string | null;
  billable: boolean;
  invoiced: boolean;
  invoiceId: string | null;
  createdAt: Date;
  updatedAt: Date;
  client?: Client | null;
  project?: ClientProject | null;
}

// Time Block for the UI (extends TimeEntry with display info)
export interface TimeBlock extends TimeEntry {
  // Calculated display times in Eastern
  displayStartTime: Date;
  displayEndTime: Date;
  // UI positioning
  dayOfWeek: number; // 0-6 (Monday-Sunday)
  startMinutes: number; // Minutes from midnight in display timezone
  durationMinutes: number;
}

// Invoice Types
export interface Invoice {
  id: string;
  userId: string;
  invoiceNumber: string;
  clientId: string | null;
  clientName: string;
  clientEmail: string | null;
  clientAddress: string | null;
  issueDate: Date;
  dueDate: Date | null;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  notes: string | null;
  terms: string | null;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lineItems?: InvoiceLineItem[];
  timeEntries?: TimeEntry[];
}

export interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  order: number;
  createdAt: Date;
}

export interface InvoiceSettings {
  id: string;
  userId: string;
  businessName: string | null;
  businessEmail: string | null;
  businessPhone: string | null;
  businessAddress: string | null;
  businessWebsite: string | null;
  logoUrl: string | null;
  letterheadUrl: string | null;
  accentColor: string | null;
  defaultTaxRate: number;
  defaultPaymentTerms: string | null;
  defaultNotes: string | null;
  invoicePrefix: string;
  nextInvoiceNumber: number;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankRoutingNumber: string | null;
  paypalEmail: string | null;
  venmoHandle: string | null;
  footerText: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Form Data Types
export interface ClientFormData {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  hourlyRate: number;
  color: string;
  isActive?: boolean;
}

export interface ProjectFormData {
  clientId: string;
  name: string;
  description?: string;
  hourlyRate?: number;
  isActive?: boolean;
}

export interface TimeEntryFormData {
  clientId?: string;
  projectId?: string;
  startTimeUtc: Date;
  endTimeUtc: Date;
  description?: string;
  billable?: boolean;
}

export interface InvoiceFormData {
  clientId: string;
  startDate: Date;
  endDate: Date;
  invoiceNumber?: string;
  dueDate?: Date;
  notes?: string;
  terms?: string;
  taxRate?: number;
  additionalLineItems?: Array<{
    description: string;
    quantity: number;
    rate: number;
  }>;
}

// Week Navigation
export interface WeekRange {
  start: Date; // Monday 00:00:00 UTC
  end: Date;   // Sunday 23:59:59 UTC
  weekNumber: number;
  year: number;
}

// Time slot for drag-creation
export interface TimeSlot {
  day: number; // 0-6 (Monday-Sunday)
  hour: number; // 0-23
  minutes: number; // 0, 15, 30, 45
}

// Constants
export const SNAP_MINUTES = 15;
export const HOUR_HEIGHT = 60; // pixels per hour
export const DAY_START_HOUR = 0;
export const DAY_END_HOUR = 24;
export const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
export const DISPLAY_TIMEZONE = 'America/New_York';

// Color presets for clients
export const CLIENT_COLORS = [
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#6366f1', // Indigo
] as const;
