// User Types
export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  roles: string[];
}

// Portfolio Types
export interface PortfolioSettings {
  id: string;
  heroTitle: string;
  heroSubtitle: string;
  heroImage: string | null;
  aboutTitle: string;
  aboutText: string;
  aboutImage: string | null;
  name: string;
  profile: string;
  email: string;
  location: string;
  linkedIn: string | null;
  github: string | null;
  resumeSummary: string | null;
}

export interface Skill {
  id: string;
  name: string;
  category: 'languages' | 'frameworks' | 'tools';
  icon: string | null;
  order: number;
}

export interface Education {
  id: string;
  degree: string;
  institution: string;
  startYear: string;
  endYear: string | null;
  description: string | null;
  order: number;
}

export interface Experience {
  id: string;
  title: string;
  company: string;
  location: string | null;
  startDate: string;
  endDate: string | null;
  description: string | null;
  highlights: string[];
  order: number;
}

export interface Service {
  id: string;
  title: string;
  description: string;
  icon: string | null;
  order: number;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  image: string | null;
  technologies: string[];
  liveUrl: string | null;
  sourceUrl: string | null;
  featured: boolean;
  order: number;
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  order: number;
}

// Role Types
export type RoleName = 'Super Admin' | 'Admin' | 'Editor' | 'User';

export const ROLES: { name: RoleName; description: string }[] = [
  { name: 'Super Admin', description: 'Full system access including user management' },
  { name: 'Admin', description: 'Administrative access with logs viewing' },
  { name: 'Editor', description: 'Can edit portfolio content' },
  { name: 'User', description: 'Basic authenticated user' },
];

// Navigation Types
export interface NavItem {
  label: string;
  href: string;
  icon: string;
  roles?: RoleName[]; // If undefined, accessible to all authenticated users
}

// Log Types
export interface Log {
  id: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  metadata: Record<string, unknown> | null;
  userId: string | null;
  createdAt: Date;
  user?: {
    name: string;
    email: string;
  } | null;
}

// AI Insight Types
export interface AIInsight {
  id: string;
  title: string;
  content: string;
  type: 'analytics' | 'recommendation' | 'alert';
  status: 'unread' | 'read' | 'archived';
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

// File Types
export interface FileItem {
  id: string;
  name: string;
  key: string;
  url: string;
  size: number;
  type: string;
  uploadedBy: string | null;
  createdAt: Date;
}

// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
