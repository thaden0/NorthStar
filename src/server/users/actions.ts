'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getSession, isSuperAdmin, hashPassword } from '@/lib/auth';

// ==================== SCHEMAS ====================
const updateUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
});

const resetPasswordSchema = z.object({
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

// ==================== TYPES ====================
export interface UserActionResult {
  success: boolean;
  error?: string;
  errors?: Record<string, string>;
}

// ==================== ACTIONS ====================

export async function updateUserAction(
  userId: string,
  formData: FormData
): Promise<UserActionResult> {
  const session = await getSession();
  if (!session || !isSuperAdmin(session)) {
    return { success: false, error: 'Unauthorized' };
  }

  const data = {
    name: formData.get('name') as string,
    email: formData.get('email') as string,
  };

  const validation = updateUserSchema.safeParse(data);
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
  const existingUser = await db.user.findUnique({
    where: { email: data.email.toLowerCase() },
  });
  
  if (existingUser && existingUser.id !== userId) {
    return { success: false, error: 'This email is already in use by another user' };
  }

  await db.user.update({
    where: { id: userId },
    data: {
      name: data.name,
      email: data.email.toLowerCase(),
    },
  });

  return { success: true };
}

export async function resetUserPasswordAction(
  userId: string,
  formData: FormData
): Promise<UserActionResult> {
  const session = await getSession();
  if (!session || !isSuperAdmin(session)) {
    return { success: false, error: 'Unauthorized' };
  }

  const data = {
    newPassword: formData.get('newPassword') as string,
  };

  const validation = resetPasswordSchema.safeParse(data);
  if (!validation.success) {
    const errors: Record<string, string> = {};
    validation.error.issues.forEach((err) => {
      if (err.path[0]) {
        errors[err.path[0] as string] = err.message;
      }
    });
    return { success: false, errors };
  }

  const hashedPassword = await hashPassword(data.newPassword);
  
  await db.user.update({
    where: { id: userId },
    data: { hashedPassword },
  });

  return { success: true };
}

export async function updateUserRolesAction(
  userId: string,
  roleIds: string[]
): Promise<UserActionResult> {
  const session = await getSession();
  if (!session || !isSuperAdmin(session)) {
    return { success: false, error: 'Unauthorized' };
  }

  // Cannot remove super admin role from yourself
  if (userId === session.userId) {
    const superAdminRole = await db.role.findUnique({
      where: { name: 'Super Admin' },
    });
    if (superAdminRole && !roleIds.includes(superAdminRole.id)) {
      return { success: false, error: 'You cannot remove your own Super Admin role' };
    }
  }

  // Delete existing roles and add new ones
  await db.userRole.deleteMany({
    where: { userId },
  });

  if (roleIds.length > 0) {
    await db.userRole.createMany({
      data: roleIds.map((roleId) => ({
        userId,
        roleId,
      })),
    });
  }

  return { success: true };
}

export async function deleteUserAction(userId: string): Promise<UserActionResult> {
  const session = await getSession();
  if (!session || !isSuperAdmin(session)) {
    return { success: false, error: 'Unauthorized' };
  }

  // Cannot delete yourself
  if (userId === session.userId) {
    return { success: false, error: 'You cannot delete your own account' };
  }

  await db.user.delete({
    where: { id: userId },
  });

  redirect('/dashboard/users');
}
