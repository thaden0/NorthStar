import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession, isSuperAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { FiArrowLeft, FiCode } from 'react-icons/fi';
import SkillsList from './SkillsList';
import styles from '../portfolio.module.css';

export const dynamic = 'force-dynamic';

async function getSkills() {
  const skills = await db.skill.findMany({
    orderBy: { order: 'asc' },
  });
  return skills;
}

export default async function SkillsPage() {
  const session = await getSession();
  
  if (!session || !isSuperAdmin(session)) {
    redirect('/dashboard');
  }

  const skills = await getSkills();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerInfo}>
          <Link href="/dashboard/portfolio" className={styles.backLink}>
            <FiArrowLeft /> Back to Portfolio
          </Link>
          <h1 className={styles.title}>
            <FiCode style={{ marginRight: '12px', color: 'var(--purple-violet)' }} />
            Skills
          </h1>
          <p className={styles.subtitle}>
            Manage your technical skills organized by category
          </p>
        </div>
      </div>

      <SkillsList initialSkills={skills} />
    </div>
  );
}
