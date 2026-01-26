'use server';

import { z } from 'zod';
import { getSession, isSuperAdmin } from '@/lib/auth';
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
const portfolioSettingsSchema = z.object({
  heroTitle: z.string().min(1, 'Hero title is required'),
  heroSubtitle: z.string().min(1, 'Hero subtitle is required'),
  heroImage: z.string().optional().nullable(),
  aboutTitle: z.string().min(1, 'About title is required'),
  aboutText: z.string().min(1, 'About text is required'),
  aboutImage: z.string().optional().nullable(),
  name: z.string().min(1, 'Name is required'),
  profile: z.string().min(1, 'Profile is required'),
  email: z.string().email('Invalid email address'),
  location: z.string().min(1, 'Location is required'),
  linkedIn: z.string().optional().nullable(),
  github: z.string().optional().nullable(),
  resumeSummary: z.string().optional().nullable(),
});

const skillSchema = z.object({
  name: z.string().min(1, 'Skill name is required'),
  category: z.enum(['languages', 'frameworks', 'tools']),
  icon: z.string().optional().nullable(),
  order: z.coerce.number().int().default(0),
});

const educationSchema = z.object({
  degree: z.string().min(1, 'Degree is required'),
  institution: z.string().min(1, 'Institution is required'),
  startYear: z.string().min(1, 'Start year is required'),
  endYear: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  order: z.coerce.number().int().default(0),
});

const experienceSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  company: z.string().min(1, 'Company is required'),
  location: z.string().optional().nullable(),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  highlights: z.array(z.string()).default([]),
  order: z.coerce.number().int().default(0),
});

const serviceSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  icon: z.string().optional().nullable(),
  order: z.coerce.number().int().default(0),
});

const projectSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  image: z.string().optional().nullable(),
  technologies: z.array(z.string()).default([]),
  liveUrl: z.string().optional().nullable(),
  sourceUrl: z.string().optional().nullable(),
  featured: z.boolean().default(false),
  order: z.coerce.number().int().default(0),
});

const faqSchema = z.object({
  question: z.string().min(1, 'Question is required'),
  answer: z.string().min(1, 'Answer is required'),
  order: z.coerce.number().int().default(0),
});

// ==================== HELPERS ====================
async function checkSuperAdmin(): Promise<ActionResult | null> {
  const session = await getSession();
  if (!session || !isSuperAdmin(session)) {
    return { success: false, error: 'Unauthorized: Super admin access required' };
  }
  return null;
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

// ==================== PORTFOLIO SETTINGS ====================
export async function updatePortfolioSettingsAction(formData: FormData): Promise<ActionResult> {
  const authError = await checkSuperAdmin();
  if (authError) return authError;

  const data = {
    heroTitle: formData.get('heroTitle') as string,
    heroSubtitle: formData.get('heroSubtitle') as string,
    heroImage: formData.get('heroImage') as string || null,
    aboutTitle: formData.get('aboutTitle') as string,
    aboutText: formData.get('aboutText') as string,
    aboutImage: formData.get('aboutImage') as string || null,
    name: formData.get('name') as string,
    profile: formData.get('profile') as string,
    email: formData.get('email') as string,
    location: formData.get('location') as string,
    linkedIn: formData.get('linkedIn') as string || null,
    github: formData.get('github') as string || null,
    resumeSummary: formData.get('resumeSummary') as string || null,
  };

  const validation = portfolioSettingsSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, errors: parseValidationErrors(validation.error) };
  }

  const existing = await db.portfolioSettings.findFirst();
  
  if (existing) {
    await db.portfolioSettings.update({
      where: { id: existing.id },
      data: validation.data,
    });
  } else {
    await db.portfolioSettings.create({
      data: validation.data,
    });
  }

  revalidatePath('/');
  revalidatePath('/dashboard/portfolio/settings');
  return { success: true };
}

// ==================== SKILLS ====================
export async function createSkillAction(formData: FormData): Promise<ActionResult> {
  const authError = await checkSuperAdmin();
  if (authError) return authError;

  const data = {
    name: formData.get('name') as string,
    category: formData.get('category') as string,
    icon: formData.get('icon') as string || null,
    order: parseInt(formData.get('order') as string) || 0,
  };

  const validation = skillSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, errors: parseValidationErrors(validation.error) };
  }

  const skill = await db.skill.create({ data: validation.data });
  
  revalidatePath('/');
  revalidatePath('/dashboard/portfolio/skills');
  return { success: true, data: skill };
}

export async function updateSkillAction(id: string, formData: FormData): Promise<ActionResult> {
  const authError = await checkSuperAdmin();
  if (authError) return authError;

  const data = {
    name: formData.get('name') as string,
    category: formData.get('category') as string,
    icon: formData.get('icon') as string || null,
    order: parseInt(formData.get('order') as string) || 0,
  };

  const validation = skillSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, errors: parseValidationErrors(validation.error) };
  }

  await db.skill.update({ where: { id }, data: validation.data });
  
  revalidatePath('/');
  revalidatePath('/dashboard/portfolio/skills');
  return { success: true };
}

export async function deleteSkillAction(id: string): Promise<ActionResult> {
  const authError = await checkSuperAdmin();
  if (authError) return authError;

  await db.skill.delete({ where: { id } });
  
  revalidatePath('/');
  revalidatePath('/dashboard/portfolio/skills');
  return { success: true };
}

// ==================== EDUCATION ====================
export async function createEducationAction(formData: FormData): Promise<ActionResult> {
  const authError = await checkSuperAdmin();
  if (authError) return authError;

  const data = {
    degree: formData.get('degree') as string,
    institution: formData.get('institution') as string,
    startYear: formData.get('startYear') as string,
    endYear: formData.get('endYear') as string || null,
    description: formData.get('description') as string || null,
    order: parseInt(formData.get('order') as string) || 0,
  };

  const validation = educationSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, errors: parseValidationErrors(validation.error) };
  }

  const education = await db.education.create({ data: validation.data });
  
  revalidatePath('/');
  revalidatePath('/dashboard/portfolio/education');
  return { success: true, data: education };
}

export async function updateEducationAction(id: string, formData: FormData): Promise<ActionResult> {
  const authError = await checkSuperAdmin();
  if (authError) return authError;

  const data = {
    degree: formData.get('degree') as string,
    institution: formData.get('institution') as string,
    startYear: formData.get('startYear') as string,
    endYear: formData.get('endYear') as string || null,
    description: formData.get('description') as string || null,
    order: parseInt(formData.get('order') as string) || 0,
  };

  const validation = educationSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, errors: parseValidationErrors(validation.error) };
  }

  await db.education.update({ where: { id }, data: validation.data });
  
  revalidatePath('/');
  revalidatePath('/dashboard/portfolio/education');
  return { success: true };
}

export async function deleteEducationAction(id: string): Promise<ActionResult> {
  const authError = await checkSuperAdmin();
  if (authError) return authError;

  await db.education.delete({ where: { id } });
  
  revalidatePath('/');
  revalidatePath('/dashboard/portfolio/education');
  return { success: true };
}

// ==================== EXPERIENCE ====================
export async function createExperienceAction(formData: FormData): Promise<ActionResult> {
  const authError = await checkSuperAdmin();
  if (authError) return authError;

  const highlightsRaw = formData.get('highlights') as string;
  const highlights = highlightsRaw ? highlightsRaw.split('\n').filter(h => h.trim()) : [];

  const data = {
    title: formData.get('title') as string,
    company: formData.get('company') as string,
    location: formData.get('location') as string || null,
    startDate: formData.get('startDate') as string,
    endDate: formData.get('endDate') as string || null,
    description: formData.get('description') as string || null,
    highlights,
    order: parseInt(formData.get('order') as string) || 0,
  };

  const validation = experienceSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, errors: parseValidationErrors(validation.error) };
  }

  const experience = await db.experience.create({ data: validation.data });
  
  revalidatePath('/');
  revalidatePath('/dashboard/portfolio/experience');
  return { success: true, data: experience };
}

export async function updateExperienceAction(id: string, formData: FormData): Promise<ActionResult> {
  const authError = await checkSuperAdmin();
  if (authError) return authError;

  const highlightsRaw = formData.get('highlights') as string;
  const highlights = highlightsRaw ? highlightsRaw.split('\n').filter(h => h.trim()) : [];

  const data = {
    title: formData.get('title') as string,
    company: formData.get('company') as string,
    location: formData.get('location') as string || null,
    startDate: formData.get('startDate') as string,
    endDate: formData.get('endDate') as string || null,
    description: formData.get('description') as string || null,
    highlights,
    order: parseInt(formData.get('order') as string) || 0,
  };

  const validation = experienceSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, errors: parseValidationErrors(validation.error) };
  }

  await db.experience.update({ where: { id }, data: validation.data });
  
  revalidatePath('/');
  revalidatePath('/dashboard/portfolio/experience');
  return { success: true };
}

export async function deleteExperienceAction(id: string): Promise<ActionResult> {
  const authError = await checkSuperAdmin();
  if (authError) return authError;

  await db.experience.delete({ where: { id } });
  
  revalidatePath('/');
  revalidatePath('/dashboard/portfolio/experience');
  return { success: true };
}

// ==================== SERVICES ====================
export async function createServiceAction(formData: FormData): Promise<ActionResult> {
  const authError = await checkSuperAdmin();
  if (authError) return authError;

  const data = {
    title: formData.get('title') as string,
    description: formData.get('description') as string,
    icon: formData.get('icon') as string || null,
    order: parseInt(formData.get('order') as string) || 0,
  };

  const validation = serviceSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, errors: parseValidationErrors(validation.error) };
  }

  const service = await db.service.create({ data: validation.data });
  
  revalidatePath('/');
  revalidatePath('/dashboard/portfolio/services');
  return { success: true, data: service };
}

export async function updateServiceAction(id: string, formData: FormData): Promise<ActionResult> {
  const authError = await checkSuperAdmin();
  if (authError) return authError;

  const data = {
    title: formData.get('title') as string,
    description: formData.get('description') as string,
    icon: formData.get('icon') as string || null,
    order: parseInt(formData.get('order') as string) || 0,
  };

  const validation = serviceSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, errors: parseValidationErrors(validation.error) };
  }

  await db.service.update({ where: { id }, data: validation.data });
  
  revalidatePath('/');
  revalidatePath('/dashboard/portfolio/services');
  return { success: true };
}

export async function deleteServiceAction(id: string): Promise<ActionResult> {
  const authError = await checkSuperAdmin();
  if (authError) return authError;

  await db.service.delete({ where: { id } });
  
  revalidatePath('/');
  revalidatePath('/dashboard/portfolio/services');
  return { success: true };
}

// ==================== PROJECTS ====================
export async function createProjectAction(formData: FormData): Promise<ActionResult> {
  const authError = await checkSuperAdmin();
  if (authError) return authError;

  const technologiesRaw = formData.get('technologies') as string;
  const technologies = technologiesRaw ? technologiesRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

  const data = {
    title: formData.get('title') as string,
    description: formData.get('description') as string,
    image: formData.get('image') as string || null,
    technologies,
    liveUrl: formData.get('liveUrl') as string || null,
    sourceUrl: formData.get('sourceUrl') as string || null,
    featured: formData.get('featured') === 'true',
    order: parseInt(formData.get('order') as string) || 0,
  };

  const validation = projectSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, errors: parseValidationErrors(validation.error) };
  }

  const project = await db.project.create({ data: validation.data });
  
  revalidatePath('/');
  revalidatePath('/dashboard/portfolio/projects');
  return { success: true, data: project };
}

export async function updateProjectAction(id: string, formData: FormData): Promise<ActionResult> {
  const authError = await checkSuperAdmin();
  if (authError) return authError;

  const technologiesRaw = formData.get('technologies') as string;
  const technologies = technologiesRaw ? technologiesRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

  const data = {
    title: formData.get('title') as string,
    description: formData.get('description') as string,
    image: formData.get('image') as string || null,
    technologies,
    liveUrl: formData.get('liveUrl') as string || null,
    sourceUrl: formData.get('sourceUrl') as string || null,
    featured: formData.get('featured') === 'true',
    order: parseInt(formData.get('order') as string) || 0,
  };

  const validation = projectSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, errors: parseValidationErrors(validation.error) };
  }

  await db.project.update({ where: { id }, data: validation.data });
  
  revalidatePath('/');
  revalidatePath('/dashboard/portfolio/projects');
  return { success: true };
}

export async function deleteProjectAction(id: string): Promise<ActionResult> {
  const authError = await checkSuperAdmin();
  if (authError) return authError;

  await db.project.delete({ where: { id } });
  
  revalidatePath('/');
  revalidatePath('/dashboard/portfolio/projects');
  return { success: true };
}

// ==================== FAQS ====================
export async function createFaqAction(formData: FormData): Promise<ActionResult> {
  const authError = await checkSuperAdmin();
  if (authError) return authError;

  const data = {
    question: formData.get('question') as string,
    answer: formData.get('answer') as string,
    order: parseInt(formData.get('order') as string) || 0,
  };

  const validation = faqSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, errors: parseValidationErrors(validation.error) };
  }

  const faq = await db.fAQ.create({ data: validation.data });
  
  revalidatePath('/');
  revalidatePath('/dashboard/portfolio/faqs');
  return { success: true, data: faq };
}

export async function updateFaqAction(id: string, formData: FormData): Promise<ActionResult> {
  const authError = await checkSuperAdmin();
  if (authError) return authError;

  const data = {
    question: formData.get('question') as string,
    answer: formData.get('answer') as string,
    order: parseInt(formData.get('order') as string) || 0,
  };

  const validation = faqSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, errors: parseValidationErrors(validation.error) };
  }

  await db.fAQ.update({ where: { id }, data: validation.data });
  
  revalidatePath('/');
  revalidatePath('/dashboard/portfolio/faqs');
  return { success: true };
}

export async function deleteFaqAction(id: string): Promise<ActionResult> {
  const authError = await checkSuperAdmin();
  if (authError) return authError;

  await db.fAQ.delete({ where: { id } });
  
  revalidatePath('/');
  revalidatePath('/dashboard/portfolio/faqs');
  return { success: true };
}
