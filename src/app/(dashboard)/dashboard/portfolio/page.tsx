import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession, isSuperAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { 
  FiBriefcase, 
  FiUser, 
  FiBook, 
  FiCode, 
  FiTool, 
  FiFolder, 
  FiHelpCircle,
  FiEdit
} from 'react-icons/fi';
import styles from '../dashboard.module.css';

async function getPortfolioStats() {
  const [skills, education, experiences, services, projects, faqs] = await Promise.all([
    db.skill.count(),
    db.education.count(),
    db.experience.count(),
    db.service.count(),
    db.project.count(),
    db.fAQ.count(),
  ]);

  return { skills, education, experiences, services, projects, faqs };
}

export default async function PortfolioPage() {
  const session = await getSession();
  
  if (!session || !isSuperAdmin(session)) {
    redirect('/dashboard');
  }

  const stats = await getPortfolioStats();

  const sections = [
    { 
      title: 'General Settings', 
      description: 'Hero text, about section, contact info', 
      icon: <FiUser />, 
      href: '/dashboard/portfolio/settings',
      color: 'linear-gradient(135deg, #3B82F6, #2563EB)',
    },
    { 
      title: 'Skills', 
      description: `${stats.skills} skills configured`, 
      icon: <FiCode />, 
      href: '/dashboard/portfolio/skills',
      color: 'linear-gradient(135deg, #8B5CF6, #6D28D9)',
    },
    { 
      title: 'Education', 
      description: `${stats.education} entries`, 
      icon: <FiBook />, 
      href: '/dashboard/portfolio/education',
      color: 'linear-gradient(135deg, #22D3EE, #0891B2)',
    },
    { 
      title: 'Experience', 
      description: `${stats.experiences} positions`, 
      icon: <FiBriefcase />, 
      href: '/dashboard/portfolio/experience',
      color: 'linear-gradient(135deg, #F59E0B, #D97706)',
    },
    { 
      title: 'Services', 
      description: `${stats.services} services`, 
      icon: <FiTool />, 
      href: '/dashboard/portfolio/services',
      color: 'linear-gradient(135deg, #22C55E, #16A34A)',
    },
    { 
      title: 'Projects', 
      description: `${stats.projects} projects`, 
      icon: <FiFolder />, 
      href: '/dashboard/portfolio/projects',
      color: 'linear-gradient(135deg, #F472B6, #DB2777)',
    },
    { 
      title: 'FAQs', 
      description: `${stats.faqs} questions`, 
      icon: <FiHelpCircle />, 
      href: '/dashboard/portfolio/faqs',
      color: 'linear-gradient(135deg, #A855F7, #9333EA)',
    },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            <FiBriefcase style={{ marginRight: '12px', color: 'var(--purple-violet)' }} />
            Portfolio Settings
          </h1>
          <p className={styles.subtitle}>
            Manage your portfolio content without touching code
          </p>
        </div>
        <Link 
          href="/" 
          target="_blank"
          className="btn-secondary" 
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          View Portfolio
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-5)' }}>
        {sections.map((section) => (
          <Link
            key={section.title}
            href={section.href}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 'var(--space-4)',
              padding: 'var(--space-5)',
              background: 'var(--glass-1)',
              border: '1px solid var(--glass-border)',
              borderRadius: 'var(--radius-xl)',
              textDecoration: 'none',
              transition: 'all 250ms ease',
            }}
            className="portfolio-section-card"
          >
            <div
              style={{
                width: '50px',
                height: '50px',
                borderRadius: 'var(--radius-lg)',
                background: section.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '1.25rem',
                flexShrink: 0,
                boxShadow: '0 0 20px rgba(59, 130, 246, 0.3)',
              }}
            >
              {section.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                  {section.title}
                </h3>
                <FiEdit style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }} />
              </div>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                {section.description}
              </p>
            </div>
          </Link>
        ))}
      </div>

      <style>{`
        .portfolio-section-card:hover {
          background: var(--glass-2) !important;
          border-color: var(--glass-border-hover) !important;
          transform: translateY(-2px);
          box-shadow: var(--shadow-lg);
        }
      `}</style>
    </div>
  );
}
