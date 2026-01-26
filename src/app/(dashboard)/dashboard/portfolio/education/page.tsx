import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession, isSuperAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { FiArrowLeft, FiBook } from 'react-icons/fi';
import EducationList from './EducationList';
import styles from '../portfolio.module.css';

export const dynamic = 'force-dynamic';

async function getEducation() {
  const education = await db.education.findMany({
    orderBy: { order: 'asc' },
  });
  return education;
}

export default async function EducationPage() {
  const session = await getSession();
  
  if (!session || !isSuperAdmin(session)) {
    redirect('/dashboard');
  }

  const education = await getEducation();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerInfo}>
          <Link href="/dashboard/portfolio" className={styles.backLink}>
            <FiArrowLeft /> Back to Portfolio
          </Link>
          <h1 className={styles.title}>
            <FiBook style={{ marginRight: '12px', color: 'var(--cyan-teal)' }} />
            Education
          </h1>
          <p className={styles.subtitle}>
            Manage your educational background and qualifications
          </p>
        </div>
      </div>

      <EducationList initialEducation={education} />
    </div>
  );
}
