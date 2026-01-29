import { Injectable, Logger } from '@nestjs/common';

export interface PortfolioSkillsData {
  languages: string[];
  frameworks: string[];
  tools: string[];
}

export interface PortfolioExperienceData {
  title: string;
  company: string;
  location: string | null;
  startDate: string;
  endDate: string | null;
  description: string | null;
  highlights: string[];
}

export interface PortfolioEducationData {
  degree: string;
  institution: string;
  startYear: string;
  endYear: string | null;
  description: string | null;
}

export interface PortfolioServiceData {
  title: string;
  description: string;
}

export interface PortfolioProjectData {
  title: string;
  description: string;
  technologies: string[];
  featured: boolean;
  liveUrl: string | null;
  sourceUrl: string | null;
}

export interface PortfolioFAQData {
  question: string;
  answer: string;
}

export interface PortfolioData {
  name: string;
  profile: string;
  email: string;
  location: string;
  linkedIn: string | null;
  github: string | null;
  heroTitle: string;
  heroSubtitle: string;
  aboutTitle: string;
  aboutText: string;
  resumeSummary: string;
  skills: PortfolioSkillsData;
  experience: PortfolioExperienceData[];
  education: PortfolioEducationData[];
  services: PortfolioServiceData[];
  projects: PortfolioProjectData[];
  faqs: PortfolioFAQData[];
}

@Injectable()
export class PortfolioService {
  private readonly logger = new Logger(PortfolioService.name);
  private cachedPortfolio: PortfolioData | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Get portfolio data (with caching)
   */
  async getPortfolio(): Promise<{ success: boolean; data?: PortfolioData; error?: string }> {
    // Return cached data if still valid
    if (this.cachedPortfolio && Date.now() - this.cacheTimestamp < this.CACHE_TTL_MS) {
      return { success: true, data: this.cachedPortfolio };
    }

    try {
      const baseUrl = process.env.NORTHSTAR_API_URL || 'http://localhost:3000';
      
      const response = await fetch(`${baseUrl}/api/portfolio`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `API error: ${error}` };
      }

      const result = await response.json();
      
      // Update cache
      this.cachedPortfolio = result.data;
      this.cacheTimestamp = Date.now();
      
      return { success: true, data: result.data };
    } catch (error) {
      this.logger.error('Failed to get portfolio:', error);
      
      // Return cached data even if stale, rather than failing
      if (this.cachedPortfolio) {
        this.logger.warn('Returning stale cached portfolio data');
        return { success: true, data: this.cachedPortfolio };
      }
      
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Build a concise portfolio context string for the system prompt
   */
  async getPortfolioContext(): Promise<string> {
    const result = await this.getPortfolio();
    
    if (!result.success || !result.data) {
      return ''; // Return empty string if portfolio unavailable
    }

    const p = result.data;
    
    // Build a concise but comprehensive context
    const sections: string[] = [];
    
    // Identity
    sections.push(`=== PORTFOLIO OWNER INFO ===`);
    sections.push(`Name: ${p.name}`);
    sections.push(`Profile: ${p.profile}`);
    sections.push(`Email: ${p.email}`);
    sections.push(`Location: ${p.location}`);
    if (p.linkedIn) sections.push(`LinkedIn: ${p.linkedIn}`);
    if (p.github) sections.push(`GitHub: ${p.github}`);
    
    // About/Summary
    if (p.resumeSummary) {
      sections.push(`\nProfessional Summary: ${p.resumeSummary}`);
    } else if (p.aboutText) {
      sections.push(`\nAbout: ${p.aboutText}`);
    }
    
    // Skills
    if (p.skills.languages.length || p.skills.frameworks.length || p.skills.tools.length) {
      sections.push(`\nSkills:`);
      if (p.skills.languages.length) sections.push(`- Languages: ${p.skills.languages.join(', ')}`);
      if (p.skills.frameworks.length) sections.push(`- Frameworks: ${p.skills.frameworks.join(', ')}`);
      if (p.skills.tools.length) sections.push(`- Tools: ${p.skills.tools.join(', ')}`);
    }
    
    // Experience (just most recent 3)
    if (p.experience.length) {
      sections.push(`\nRecent Experience:`);
      p.experience.slice(0, 3).forEach((exp: PortfolioExperienceData) => {
        const period = exp.endDate ? `${exp.startDate} - ${exp.endDate}` : `${exp.startDate} - Present`;
        sections.push(`- ${exp.title} at ${exp.company} (${period})`);
        if (exp.description) sections.push(`  ${exp.description.substring(0, 150)}...`);
      });
    }
    
    // Education
    if (p.education.length) {
      sections.push(`\nEducation:`);
      p.education.forEach((edu: PortfolioEducationData) => {
        const period = edu.endYear ? `${edu.startYear} - ${edu.endYear}` : `${edu.startYear}`;
        sections.push(`- ${edu.degree} from ${edu.institution} (${period})`);
      });
    }
    
    // Services
    if (p.services.length) {
      sections.push(`\nServices Offered:`);
      p.services.forEach((svc: PortfolioServiceData) => {
        sections.push(`- ${svc.title}: ${svc.description.substring(0, 100)}`);
      });
    }
    
    // Featured Projects
    const featuredProjects = p.projects.filter((proj: PortfolioProjectData) => proj.featured);
    if (featuredProjects.length) {
      sections.push(`\nFeatured Projects:`);
      featuredProjects.forEach((proj: PortfolioProjectData) => {
        sections.push(`- ${proj.title}: ${proj.description.substring(0, 100)}`);
        if (proj.technologies.length) sections.push(`  Technologies: ${proj.technologies.join(', ')}`);
      });
    }
    
    // FAQs
    if (p.faqs.length) {
      sections.push(`\nFAQs:`);
      p.faqs.forEach((faq: PortfolioFAQData) => {
        sections.push(`Q: ${faq.question}`);
        sections.push(`A: ${faq.answer.substring(0, 150)}`);
      });
    }
    
    return sections.join('\n');
  }

  /**
   * Clear the cache (useful when portfolio is updated)
   */
  clearCache(): void {
    this.cachedPortfolio = null;
    this.cacheTimestamp = 0;
  }
}
