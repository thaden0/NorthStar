'use server';

import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';

// ==================== TYPES ====================
export interface ActionResult {
  success: boolean;
  error?: string;
  errors?: Record<string, string>;
  data?: unknown;
}

// ==================== SCHEMAS ====================
const clientSchema = z.object({
  name: z.string().min(1, 'Client name is required'),
  email: z.string().email().optional().nullable().or(z.literal('')),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  hourlyRate: z.coerce.number().min(0, 'Hourly rate must be positive').default(0),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format').default('#3b82f6'),
  isActive: z.boolean().default(true),
});

const projectSchema = z.object({
  clientId: z.string().min(1, 'Client is required'),
  name: z.string().min(1, 'Project name is required'),
  description: z.string().optional().nullable(),
  hourlyRate: z.coerce.number().min(0).optional().nullable(),
  color: z.string().default('#3b82f6'),
  isActive: z.boolean().default(true),
});

const timeEntrySchema = z.object({
  clientId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  startTimeUtc: z.coerce.date(),
  endTimeUtc: z.coerce.date(),
  description: z.string().optional().nullable(),
  billable: z.boolean().default(true),
}).refine(data => data.endTimeUtc > data.startTimeUtc, {
  message: 'End time must be after start time',
  path: ['endTimeUtc'],
});

// ==================== HELPERS ====================
type AuthSuccess = { success: true; userId: string };
type AuthError = ActionResult & { success: false };
type AuthResult = AuthSuccess | AuthError;

async function checkAuth(): Promise<AuthResult> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: 'Unauthorized: Please log in' };
  }
  return { success: true, userId: session.userId };
}

function isAuthError(result: AuthResult): result is AuthError {
  return !result.success;
}

function parseValidationErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  error.issues.forEach((issue) => {
    if (issue.path[0]) {
      errors[issue.path[0] as string] = issue.message;
    }
  });
  return errors;
}

// ==================== CLIENTS ====================
export async function getClientsAction(): Promise<ActionResult> {
  const authResult = await checkAuth();
  if (!authResult.success) return authResult;
  const { userId } = authResult;

  const clients = await db.client.findMany({
    where: { userId },
    include: { projects: { where: { isActive: true } } },
    orderBy: { name: 'asc' },
  });

  return { success: true, data: clients };
}

export async function createClientAction(formData: FormData): Promise<ActionResult> {
  const authResult = await checkAuth();
  if (!authResult.success) return authResult;
  const { userId } = authResult;

  const data = {
    name: formData.get('name') as string,
    email: (formData.get('email') as string) || null,
    phone: (formData.get('phone') as string) || null,
    address: (formData.get('address') as string) || null,
    notes: (formData.get('notes') as string) || null,
    hourlyRate: parseFloat(formData.get('hourlyRate') as string) || 0,
    color: (formData.get('color') as string) || '#3b82f6',
    isActive: formData.get('isActive') !== 'false',
  };

  const validation = clientSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, errors: parseValidationErrors(validation.error) };
  }

  const client = await db.client.create({
    data: {
      ...validation.data,
      email: validation.data.email || null,
      userId,
    },
    include: { projects: true },
  });

  revalidatePath('/dashboard/clients');
  revalidatePath('/dashboard/time-tracking');
  return { success: true, data: client };
}

export async function updateClientAction(id: string, formData: FormData): Promise<ActionResult> {
  const authResult = await checkAuth();
  if (!authResult.success) return authResult;
  const { userId } = authResult;

  // Verify ownership
  const existing = await db.client.findFirst({
    where: { id, userId },
  });
  if (!existing) {
    return { success: false, error: 'Client not found' };
  }

  const data = {
    name: formData.get('name') as string,
    email: (formData.get('email') as string) || null,
    phone: (formData.get('phone') as string) || null,
    address: (formData.get('address') as string) || null,
    notes: (formData.get('notes') as string) || null,
    hourlyRate: parseFloat(formData.get('hourlyRate') as string) || 0,
    color: (formData.get('color') as string) || '#3b82f6',
    isActive: formData.get('isActive') !== 'false',
  };

  const validation = clientSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, errors: parseValidationErrors(validation.error) };
  }

  const client = await db.client.update({
    where: { id },
    data: {
      ...validation.data,
      email: validation.data.email || null,
    },
    include: { projects: true },
  });

  revalidatePath('/dashboard/clients');
  revalidatePath('/dashboard/time-tracking');
  return { success: true, data: client };
}

export async function deleteClientAction(id: string): Promise<ActionResult> {
  const authResult = await checkAuth();
  if (!authResult.success) return authResult;
  const { userId } = authResult;

  const existing = await db.client.findFirst({
    where: { id, userId },
  });
  if (!existing) {
    return { success: false, error: 'Client not found' };
  }

  await db.client.delete({ where: { id } });

  revalidatePath('/dashboard/clients');
  revalidatePath('/dashboard/time-tracking');
  return { success: true };
}

// ==================== PROJECTS ====================
export async function getProjectsAction(clientId?: string): Promise<ActionResult> {
  const authResult = await checkAuth();
  if (!authResult.success) return authResult;
  const { userId } = authResult;

  const projects = await db.clientProject.findMany({
    where: {
      client: { userId },
      ...(clientId ? { clientId } : {}),
    },
    include: { client: true },
    orderBy: { name: 'asc' },
  });

  return { success: true, data: projects };
}

export async function createProjectAction(formData: FormData): Promise<ActionResult> {
  const authResult = await checkAuth();
  if (!authResult.success) return authResult;
  const { userId } = authResult;

  const clientId = formData.get('clientId') as string;
  
  // Verify client ownership
  const client = await db.client.findFirst({
    where: { id: clientId, userId },
  });
  if (!client) {
    return { success: false, error: 'Client not found' };
  }

  const data = {
    clientId,
    name: formData.get('name') as string,
    description: (formData.get('description') as string) || null,
    hourlyRate: formData.get('hourlyRate') ? parseFloat(formData.get('hourlyRate') as string) : null,
    color: (formData.get('color') as string) || '#3b82f6',
    isActive: formData.get('isActive') !== 'false',
  };

  const validation = projectSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, errors: parseValidationErrors(validation.error) };
  }

  const project = await db.clientProject.create({
    data: validation.data,
    include: { client: true },
  });

  revalidatePath('/dashboard/clients');
  revalidatePath('/dashboard/time-tracking');
  return { success: true, data: project };
}

export async function updateProjectAction(id: string, formData: FormData): Promise<ActionResult> {
  const authResult = await checkAuth();
  if (!authResult.success) return authResult;
  const { userId } = authResult;

  // Verify ownership
  const existing = await db.clientProject.findFirst({
    where: { id, client: { userId } },
  });
  if (!existing) {
    return { success: false, error: 'Project not found' };
  }

  const data = {
    clientId: existing.clientId,
    name: formData.get('name') as string,
    description: (formData.get('description') as string) || null,
    hourlyRate: formData.get('hourlyRate') ? parseFloat(formData.get('hourlyRate') as string) : null,
    color: (formData.get('color') as string) || '#3b82f6',
    isActive: formData.get('isActive') !== 'false',
  };

  const validation = projectSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, errors: parseValidationErrors(validation.error) };
  }

  const project = await db.clientProject.update({
    where: { id },
    data: validation.data,
    include: { client: true },
  });

  revalidatePath('/dashboard/clients');
  revalidatePath('/dashboard/time-tracking');
  return { success: true, data: project };
}

export async function deleteProjectAction(id: string): Promise<ActionResult> {
  const authResult = await checkAuth();
  if (!authResult.success) return authResult;
  const { userId } = authResult;

  const existing = await db.clientProject.findFirst({
    where: { id, client: { userId } },
  });
  if (!existing) {
    return { success: false, error: 'Project not found' };
  }

  await db.clientProject.delete({ where: { id } });

  revalidatePath('/dashboard/clients');
  revalidatePath('/dashboard/time-tracking');
  return { success: true };
}

// ==================== TIME ENTRIES ====================
export async function getTimeEntriesAction(startDate: Date, endDate: Date): Promise<ActionResult> {
  const authResult = await checkAuth();
  if (!authResult.success) return authResult;
  const { userId } = authResult;

  const entries = await db.timeEntry.findMany({
    where: {
      userId,
      startTimeUtc: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      client: true,
      project: true,
    },
    orderBy: { startTimeUtc: 'asc' },
  });

  return { success: true, data: entries };
}

export async function createTimeEntryAction(data: {
  clientId?: string | null;
  projectId?: string | null;
  startTimeUtc: Date;
  endTimeUtc: Date;
  description?: string | null;
  billable?: boolean;
}): Promise<ActionResult> {
  const authResult = await checkAuth();
  if (!authResult.success) return authResult;
  const { userId } = authResult;

  const validation = timeEntrySchema.safeParse(data);
  if (!validation.success) {
    return { success: false, errors: parseValidationErrors(validation.error) };
  }

  // Verify client/project ownership if specified
  if (validation.data.clientId) {
    const client = await db.client.findFirst({
      where: { id: validation.data.clientId, userId },
    });
    if (!client) {
      return { success: false, error: 'Client not found' };
    }
  }

  if (validation.data.projectId) {
    const project = await db.clientProject.findFirst({
      where: { id: validation.data.projectId, client: { userId } },
    });
    if (!project) {
      return { success: false, error: 'Project not found' };
    }
  }

  const entry = await db.timeEntry.create({
    data: {
      ...validation.data,
      userId,
    },
    include: {
      client: true,
      project: true,
    },
  });

  revalidatePath('/dashboard/time-tracking');
  return { success: true, data: entry };
}

export async function updateTimeEntryAction(id: string, data: {
  clientId?: string | null;
  projectId?: string | null;
  startTimeUtc?: Date;
  endTimeUtc?: Date;
  description?: string | null;
  billable?: boolean;
}): Promise<ActionResult> {
  const authResult = await checkAuth();
  if (!authResult.success) return authResult;
  const { userId } = authResult;

  // Verify ownership
  const existing = await db.timeEntry.findFirst({
    where: { id, userId },
  });
  if (!existing) {
    return { success: false, error: 'Time entry not found' };
  }

  const mergedData = {
    clientId: data.clientId !== undefined ? data.clientId : existing.clientId,
    projectId: data.projectId !== undefined ? data.projectId : existing.projectId,
    startTimeUtc: data.startTimeUtc || existing.startTimeUtc,
    endTimeUtc: data.endTimeUtc || existing.endTimeUtc,
    description: data.description !== undefined ? data.description : existing.description,
    billable: data.billable !== undefined ? data.billable : existing.billable,
  };

  const validation = timeEntrySchema.safeParse(mergedData);
  if (!validation.success) {
    return { success: false, errors: parseValidationErrors(validation.error) };
  }

  const entry = await db.timeEntry.update({
    where: { id },
    data: validation.data,
    include: {
      client: true,
      project: true,
    },
  });

  revalidatePath('/dashboard/time-tracking');
  return { success: true, data: entry };
}

export async function deleteTimeEntryAction(id: string): Promise<ActionResult> {
  const authResult = await checkAuth();
  if (!authResult.success) return authResult;
  const { userId } = authResult;

  const existing = await db.timeEntry.findFirst({
    where: { id, userId },
  });
  if (!existing) {
    return { success: false, error: 'Time entry not found' };
  }

  await db.timeEntry.delete({ where: { id } });

  revalidatePath('/dashboard/time-tracking');
  return { success: true };
}

// ==================== INVOICE SETTINGS ====================
export async function getInvoiceSettingsAction(): Promise<ActionResult> {
  const authResult = await checkAuth();
  if (!authResult.success) return authResult;
  const { userId } = authResult;

  let settings = await db.invoiceSettings.findUnique({
    where: { userId },
  });

  // Create default settings if not exists
  if (!settings) {
    settings = await db.invoiceSettings.create({
      data: { userId },
    });
  }

  return { success: true, data: settings };
}

export async function updateInvoiceSettingsAction(formData: FormData): Promise<ActionResult> {
  const authResult = await checkAuth();
  if (!authResult.success) return authResult;
  const { userId } = authResult;

  const data = {
    businessName: (formData.get('businessName') as string) || null,
    businessEmail: (formData.get('businessEmail') as string) || null,
    businessPhone: (formData.get('businessPhone') as string) || null,
    businessAddress: (formData.get('businessAddress') as string) || null,
    logoUrl: (formData.get('logoUrl') as string) || null,
    defaultTaxRate: parseFloat(formData.get('defaultTaxRate') as string) || 0,
    defaultPaymentTerms: (formData.get('defaultPaymentTerms') as string) || null,
    defaultNotes: (formData.get('defaultNotes') as string) || null,
    invoicePrefix: (formData.get('invoicePrefix') as string) || 'INV-',
  };

  const settings = await db.invoiceSettings.upsert({
    where: { userId },
    create: { ...data, userId },
    update: data,
  });

  revalidatePath('/dashboard/time-tracking');
  revalidatePath('/dashboard/settings/invoices');
  return { success: true, data: settings };
}

// ==================== INVOICES ====================
export async function createInvoiceAction(data: {
  clientId: string;
  startDate: Date;
  endDate: Date;
  notes?: string;
  terms?: string;
  taxRate?: number;
  additionalLineItems?: Array<{
    description: string;
    quantity: number;
    rate: number;
  }>;
}): Promise<ActionResult> {
  const authResult = await checkAuth();
  if (!authResult.success) return authResult;
  const { userId } = authResult;

  // Get client info
  const client = await db.client.findFirst({
    where: { id: data.clientId, userId },
  });
  if (!client) {
    return { success: false, error: 'Client not found' };
  }

  // Get invoice settings
  const settings = await db.invoiceSettings.findUnique({
    where: { userId },
  });
  const prefix = settings?.invoicePrefix || 'INV-';
  const nextNumber = settings?.nextInvoiceNumber || 1;
  const invoiceNumber = `${prefix}${String(nextNumber).padStart(4, '0')}`;

  // Get unbilled time entries for this client in the date range
  const timeEntries = await db.timeEntry.findMany({
    where: {
      userId,
      clientId: data.clientId,
      invoiced: false,
      billable: true,
      startTimeUtc: {
        gte: data.startDate,
        lte: data.endDate,
      },
    },
    include: { project: true },
  });

  // Group entries by project and calculate totals
  const projectGroups = new Map<string, { name: string; hours: number; rate: number }>();
  
  for (const entry of timeEntries) {
    const durationHours = (entry.endTimeUtc.getTime() - entry.startTimeUtc.getTime()) / (1000 * 60 * 60);
    const rate = entry.project?.hourlyRate ?? client.hourlyRate;
    const projectName = entry.project?.name || 'General';
    const key = `${entry.projectId || 'general'}-${rate}`;
    
    const existing = projectGroups.get(key);
    if (existing) {
      existing.hours += durationHours;
    } else {
      projectGroups.set(key, {
        name: projectName,
        hours: durationHours,
        rate,
      });
    }
  }

  // Create line items
  const lineItems: Array<{ description: string; quantity: number; rate: number; amount: number; order: number }> = [];
  let order = 0;
  let subtotal = 0;

  for (const group of projectGroups.values()) {
    const amount = group.hours * group.rate;
    subtotal += amount;
    lineItems.push({
      description: `${group.name} - ${group.hours.toFixed(2)} hours @ $${group.rate.toFixed(2)}/hr`,
      quantity: group.hours,
      rate: group.rate,
      amount,
      order: order++,
    });
  }

  // Add additional line items
  if (data.additionalLineItems) {
    for (const item of data.additionalLineItems) {
      const amount = item.quantity * item.rate;
      subtotal += amount;
      lineItems.push({
        description: item.description,
        quantity: item.quantity,
        rate: item.rate,
        amount,
        order: order++,
      });
    }
  }

  const taxRate = data.taxRate ?? settings?.defaultTaxRate ?? 0;
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  // Create invoice with line items
  try {
    console.log('[createInvoiceAction] Creating invoice with data:', {
      userId,
      invoiceNumber,
      clientId: client.id,
      clientName: client.name,
      lineItemsCount: lineItems.length,
      timeEntriesCount: timeEntries.length,
    });

    const invoice = await db.invoice.create({
      data: {
        userId,
        invoiceNumber,
        clientId: client.id,
        clientName: client.name,
        clientEmail: client.email,
        clientAddress: client.address,
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        subtotal,
        taxRate,
        taxAmount,
        total,
        notes: data.notes || settings?.defaultNotes || null,
        terms: data.terms || settings?.defaultPaymentTerms || null,
        status: 'draft',
        lineItems: {
          create: lineItems,
        },
        timeEntries: {
          connect: timeEntries.map(e => ({ id: e.id })),
        },
      },
      include: {
        lineItems: true,
        timeEntries: true,
      },
    });

    console.log('[createInvoiceAction] Invoice created successfully:', invoice.id);

    // Mark time entries as invoiced
    await db.timeEntry.updateMany({
      where: { id: { in: timeEntries.map(e => e.id) } },
      data: { invoiced: true, invoiceId: invoice.id },
    });

    // Increment invoice number
    await db.invoiceSettings.update({
      where: { userId },
      data: { nextInvoiceNumber: nextNumber + 1 },
    });

    revalidatePath('/dashboard/time-tracking');
    return { success: true, data: invoice };
  } catch (error) {
    console.error('[createInvoiceAction] Error creating invoice:', error);
    console.error('[createInvoiceAction] Error details:', JSON.stringify(error, null, 2));
    return { success: false, error: `Failed to create invoice: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

export async function getInvoicesAction(): Promise<ActionResult> {
  const authResult = await checkAuth();
  if (!authResult.success) return authResult;
  const { userId } = authResult;

  const invoices = await db.invoice.findMany({
    where: { userId },
    include: {
      lineItems: { orderBy: { order: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return { success: true, data: invoices };
}
