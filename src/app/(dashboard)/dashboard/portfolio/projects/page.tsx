import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession, isSuperAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { FiArrowLeft, FiFolder } from 'react-icons/fi';
import ProjectsList from './ProjectsList';
import styles from '../portfolio.module.css';

export const dynamic = 'force-dynamic';

async function getProjects() {
  const projects = await db.project.findMany({
    orderBy: { order: 'asc' },
  });
  return projects;
}

export default async function ProjectsPage() {
  const session = await getSession();
  
  if (!session || !isSuperAdmin(session)) {
    redirect('/dashboard');
  }

  const projects = await getProjects();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerInfo}>
          <Link href="/dashboard/portfolio" className={styles.backLink}>
            <FiArrowLeft /> Back to Portfolio
          </Link>
          <h1 className={styles.title}>
            <FiFolder style={{ marginRight: '12px', color: 'var(--pink-rose)' }} />
            Projects
          </h1>
          <p className={styles.subtitle}>
            Showcase your best work and portfolio pieces
          </p>
        </div>
      </div>

      <ProjectsList initialProjects={projects} />
    </div>
  );
}
