import { redirect } from 'next/navigation';
import { getSession, isSuperAdmin } from '@/lib/auth';
import { getSiteSettings } from '@/server/settings/actions';
import { FiSettings } from 'react-icons/fi';
import SettingsClient from './SettingsClient';
import styles from './settings.module.css';

export const dynamic = 'force-dynamic';

export default async function SiteSettingsPage() {
  const session = await getSession();
  
  if (!session || !isSuperAdmin(session)) {
    redirect('/dashboard');
  }

  const settings = await getSiteSettings();

  return (
    <div style={{ padding: 'var(--space-6)' }}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          <FiSettings style={{ marginRight: '12px', color: 'var(--blue-ice)' }} />
          Site Settings
        </h1>
        <p className={styles.subtitle}>
          Configure global site settings, integrations, and preferences
        </p>
      </div>

      <SettingsClient settings={settings} />
    </div>
  );
}
