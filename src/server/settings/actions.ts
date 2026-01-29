'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { getSession, isSuperAdmin } from '@/lib/auth';
import { SiteSettings } from '@prisma/client';

export type SettingsActionResult = {
  success: boolean;
  error?: string;
  settings?: SiteSettings;
};

/**
 * Get site settings (creates default if not exists)
 */
export async function getSiteSettings(): Promise<SiteSettings> {
  let settings = await db.siteSettings.findUnique({
    where: { id: 'singleton' },
  });

  if (!settings) {
    settings = await db.siteSettings.create({
      data: { id: 'singleton' },
    });
  }

  return settings;
}

/**
 * Update site settings
 */
export async function updateSiteSettings(
  data: Partial<Omit<SiteSettings, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<SettingsActionResult> {
  const session = await getSession();

  if (!session || !isSuperAdmin(session)) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const settings = await db.siteSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', ...data },
      update: data,
    });

    revalidatePath('/dashboard/settings');
    return { success: true, settings };
  } catch (error) {
    console.error('Failed to update settings:', error);
    return { success: false, error: 'Failed to update settings' };
  }
}

/**
 * Update a single setting
 */
export async function updateSetting(
  key: keyof Omit<SiteSettings, 'id' | 'createdAt' | 'updatedAt'>,
  value: string | number | boolean | null
): Promise<SettingsActionResult> {
  const session = await getSession();

  if (!session || !isSuperAdmin(session)) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const settings = await db.siteSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', [key]: value },
      update: { [key]: value },
    });

    revalidatePath('/dashboard/settings');
    return { success: true, settings };
  } catch (error) {
    console.error(`Failed to update setting ${String(key)}:`, error);
    return { success: false, error: `Failed to update ${String(key)}` };
  }
}

/**
 * Reset settings to defaults
 */
export async function resetSettings(): Promise<SettingsActionResult> {
  const session = await getSession();

  if (!session || !isSuperAdmin(session)) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    await db.siteSettings.delete({
      where: { id: 'singleton' },
    }).catch(() => {
      // Ignore if doesn't exist
    });

    const settings = await db.siteSettings.create({
      data: { id: 'singleton' },
    });

    revalidatePath('/dashboard/settings');
    return { success: true, settings };
  } catch (error) {
    console.error('Failed to reset settings:', error);
    return { success: false, error: 'Failed to reset settings' };
  }
}
