import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession, isSuperAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { FiArrowLeft, FiTool } from 'react-icons/fi';
import ServicesList from './ServicesList';
import styles from '../portfolio.module.css';

export const dynamic = 'force-dynamic';

async function getServices() {
  const services = await db.service.findMany({
    orderBy: { order: 'asc' },
  });
  return services;
}

export default async function ServicesPage() {
  const session = await getSession();
  
  if (!session || !isSuperAdmin(session)) {
    redirect('/dashboard');
  }

  const services = await getServices();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerInfo}>
          <Link href="/dashboard/portfolio" className={styles.backLink}>
            <FiArrowLeft /> Back to Portfolio
          </Link>
          <h1 className={styles.title}>
            <FiTool style={{ marginRight: '12px', color: 'var(--status-success)' }} />
            Services
          </h1>
          <p className={styles.subtitle}>
            Manage the services you offer to clients
          </p>
        </div>
      </div>

      <ServicesList initialServices={services} />
    </div>
  );
}
