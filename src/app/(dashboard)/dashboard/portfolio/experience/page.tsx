import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession, isSuperAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { FiArrowLeft, FiBriefcase } from 'react-icons/fi';
import ExperienceList from './ExperienceList';
import styles from '../portfolio.module.css';

export const dynamic = 'force-dynamic';

async function getExperience() {
  const experience = await db.experience.findMany({
    orderBy: { order: 'asc' },
  });
  return experience;
}

export default async function ExperiencePage() {
  const session = await getSession();
  
  if (!session || !isSuperAdmin(session)) {
    redirect('/dashboard');
  }

  const experience = await getExperience();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerInfo}>
          <Link href="/dashboard/portfolio" className={styles.backLink}>
            <FiArrowLeft /> Back to Portfolio
          </Link>
          <h1 className={styles.title}>
            <FiBriefcase style={{ marginRight: '12px', color: 'var(--amber-gold)' }} />
            Experience
          </h1>
          <p className={styles.subtitle}>
            Manage your work history and professional experience
          </p>
        </div>
      </div>

      <ExperienceList initialExperience={experience} />
    </div>
  );
}
