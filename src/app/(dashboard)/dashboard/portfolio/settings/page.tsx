import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession, isSuperAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { FiArrowLeft, FiUser } from 'react-icons/fi';
import PortfolioSettingsForm from './PortfolioSettingsForm';
import styles from '../portfolio.module.css';

export const dynamic = 'force-dynamic';

async function getPortfolioSettings() {
  const settings = await db.portfolioSettings.findFirst();
  return settings;
}

export default async function PortfolioSettingsPage() {
  const session = await getSession();
  
  if (!session || !isSuperAdmin(session)) {
    redirect('/dashboard');
  }

  const settings = await getPortfolioSettings();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerInfo}>
          <Link href="/dashboard/portfolio" className={styles.backLink}>
            <FiArrowLeft /> Back to Portfolio
          </Link>
          <h1 className={styles.title}>
            <FiUser style={{ marginRight: '12px', color: 'var(--blue-ice)' }} />
            General Settings
          </h1>
          <p className={styles.subtitle}>
            Configure your portfolio hero section, about content, and contact information
          </p>
        </div>
      </div>

      <PortfolioSettingsForm settings={settings} />
    </div>
  );
}
