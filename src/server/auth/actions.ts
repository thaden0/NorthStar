'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { 
  authenticateUser, 
  createSession, 
  createUser, 
  invalidateSession,
  getSession,
  hashPassword,
  verifyPassword
} from '@/lib/auth';
import { db } from '@/lib/db';

// ==================== SCHEMAS ====================
const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

const updateProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

// ==================== TYPES ====================
export interface ActionResult {
  success: boolean;
  error?: string;
  errors?: Record<string, string>;
}

// ==================== ACTIONS ====================
export async function loginAction(formData: FormData): Promise<ActionResult> {
  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  };

  const validation = loginSchema.safeParse(data);
  if (!validation.success) {
    const errors: Record<string, string> = {};
    validation.error.issues.forEach((err) => {
      if (err.path[0]) {
        errors[err.path[0] as string] = err.message;
      }
    });
    return { success: false, errors };
  }

  const user = await authenticateUser(data.email, data.password);
  if (!user) {
    return { success: false, error: 'Invalid email or password' };
  }

  await createSession(user.id);
  redirect('/dashboard');
}

export async function registerAction(formData: FormData): Promise<ActionResult> {
  const data = {
    name: formData.get('name') as string,
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    confirmPassword: formData.get('confirmPassword') as string,
  };

  const validation = registerSchema.safeParse(data);
  if (!validation.success) {
    const errors: Record<string, string> = {};
    validation.error.issues.forEach((err) => {
      if (err.path[0]) {
        errors[err.path[0] as string] = err.message;
      }
    });
    return { success: false, errors };
  }

  // Check if email already exists
  const existingUser = await db.user.findUnique({
    where: { email: data.email.toLowerCase() },
  });

  if (existingUser) {
    return { success: false, error: 'An account with this email already exists' };
  }

  const user = await createUser({
    email: data.email,
    password: data.password,
    name: data.name,
  });

  await createSession(user.id);
  redirect('/dashboard');
}

export async function logoutAction(): Promise<void> {
  await invalidateSession();
  redirect('/');
}

export async function updateProfileAction(formData: FormData): Promise<ActionResult> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: 'Not authenticated' };
  }

  const data = {
    name: formData.get('name') as string,
    email: formData.get('email') as string,
  };

  const validation = updateProfileSchema.safeParse(data);
  if (!validation.success) {
    const errors: Record<string, string> = {};
    validation.error.issues.forEach((err) => {
      if (err.path[0]) {
        errors[err.path[0] as string] = err.message;
      }
    });
    return { success: false, errors };
  }

  // Check if email is taken by another user
  if (data.email.toLowerCase() !== session.user.email.toLowerCase()) {
    const existingUser = await db.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });
    if (existingUser) {
      return { success: false, error: 'This email is already in use' };
    }
  }

  // Get AI instructions (optional field)
  const aiInstructions = formData.get('aiInstructions') as string | null;

  await db.user.update({
    where: { id: session.userId },
    data: {
      name: data.name,
      email: data.email.toLowerCase(),
      aiInstructions: aiInstructions || null,
    },
  });

  return { success: true };
}

export async function changePasswordAction(formData: FormData): Promise<ActionResult> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: 'Not authenticated' };
  }

  const data = {
    currentPassword: formData.get('currentPassword') as string,
    newPassword: formData.get('newPassword') as string,
    confirmPassword: formData.get('confirmPassword') as string,
  };

  const validation = changePasswordSchema.safeParse(data);
  if (!validation.success) {
    const errors: Record<string, string> = {};
    validation.error.issues.forEach((err) => {
      if (err.path[0]) {
        errors[err.path[0] as string] = err.message;
      }
    });
    return { success: false, errors };
  }

  const user = await db.user.findUnique({
    where: { id: session.userId },
  });

  if (!user) {
    return { success: false, error: 'User not found' };
  }

  const isValid = await verifyPassword(data.currentPassword, user.hashedPassword);
  if (!isValid) {
    return { success: false, error: 'Current password is incorrect' };
  }

  const hashedPassword = await hashPassword(data.newPassword);
  await db.user.update({
    where: { id: session.userId },
    data: { hashedPassword },
  });

  return { success: true };
}

export async function updateAvatarAction(avatarUrl: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: 'Not authenticated' };
  }

  await db.user.update({
    where: { id: session.userId },
    data: { avatar: avatarUrl },
  });

  return { success: true };
}
