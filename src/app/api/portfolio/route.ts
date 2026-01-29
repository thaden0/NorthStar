import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/portfolio - Get portfolio summary for AI agent context
 * This endpoint is used by the Agent Service to include portfolio info in system prompts.
 * No auth required as portfolio is public data.
 */
export async function GET() {
  try {
    // Fetch all portfolio data in parallel
    const [settings, skills, experience, education, services, projects, faqs] = await Promise.all([
      prisma.portfolioSettings.findFirst(),
      prisma.skill.findMany({ orderBy: { order: 'asc' } }),
      prisma.experience.findMany({ orderBy: { order: 'asc' } }),
      prisma.education.findMany({ orderBy: { order: 'asc' } }),
      prisma.service.findMany({ orderBy: { order: 'asc' } }),
      prisma.project.findMany({ orderBy: { order: 'asc' } }),
      prisma.fAQ.findMany({ orderBy: { order: 'asc' } }),
    ]);

    // Build a concise summary for the AI
    const portfolio = {
      // Personal Info
      name: settings?.name || 'Unknown',
      profile: settings?.profile || '',
      email: settings?.email || '',
      location: settings?.location || '',
      linkedIn: settings?.linkedIn || null,
      github: settings?.github || null,
      
      // Hero Section
      heroTitle: settings?.heroTitle || '',
      heroSubtitle: settings?.heroSubtitle || '',
      
      // About Section
      aboutTitle: settings?.aboutTitle || '',
      aboutText: settings?.aboutText || '',
      resumeSummary: settings?.resumeSummary || '',
      
      // Skills grouped by category
      skills: {
        languages: skills.filter(s => s.category === 'languages').map(s => s.name),
        frameworks: skills.filter(s => s.category === 'frameworks').map(s => s.name),
        tools: skills.filter(s => s.category === 'tools').map(s => s.name),
      },
      
      // Experience
      experience: experience.map(e => ({
        title: e.title,
        company: e.company,
        location: e.location,
        startDate: e.startDate,
        endDate: e.endDate,
        description: e.description,
        highlights: e.highlights,
      })),
      
      // Education
      education: education.map(e => ({
        degree: e.degree,
        institution: e.institution,
        startYear: e.startYear,
        endYear: e.endYear,
        description: e.description,
      })),
      
      // Services offered
      services: services.map(s => ({
        title: s.title,
        description: s.description,
      })),
      
      // Projects
      projects: projects.map(p => ({
        title: p.title,
        description: p.description,
        technologies: p.technologies,
        featured: p.featured,
        liveUrl: p.liveUrl,
        sourceUrl: p.sourceUrl,
      })),
      
      // FAQs
      faqs: faqs.map(f => ({
        question: f.question,
        answer: f.answer,
      })),
    };

    return NextResponse.json({ success: true, data: portfolio });
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    return NextResponse.json({ error: 'Failed to fetch portfolio' }, { status: 500 });
  }
}
