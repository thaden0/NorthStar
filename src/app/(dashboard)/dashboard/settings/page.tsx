import { redirect } from 'next/navigation';
import { getSession, isSuperAdmin } from '@/lib/auth';
import { FiSettings, FiGlobe, FiMail, FiDatabase, FiShield } from 'react-icons/fi';
import styles from '../dashboard.module.css';

export const dynamic = 'force-dynamic';

export default async function SiteSettingsPage() {
  const session = await getSession();
  
  if (!session || !isSuperAdmin(session)) {
    redirect('/dashboard');
  }

  const settingsGroups = [
    {
      title: 'General',
      icon: <FiGlobe />,
      items: [
        { label: 'Site Name', value: 'Leonard Waugh' },
        { label: 'Site URL', value: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000' },
        { label: 'Timezone', value: 'America/Toronto' },
      ],
    },
    {
      title: 'Email',
      icon: <FiMail />,
      items: [
        { label: 'SMTP Host', value: process.env.SMTP_HOST || 'Not configured' },
        { label: 'SMTP Port', value: process.env.SMTP_PORT || '587' },
        { label: 'From Address', value: process.env.SMTP_FROM || 'Not configured' },
      ],
    },
    {
      title: 'Database',
      icon: <FiDatabase />,
      items: [
        { label: 'Type', value: 'PostgreSQL' },
        { label: 'Status', value: 'Connected', badge: 'success' },
      ],
    },
    {
      title: 'Security',
      icon: <FiShield />,
      items: [
        { label: 'Session Duration', value: '30 days' },
        { label: 'Password Policy', value: 'Strong (8+ chars, mixed case, numbers)' },
      ],
    },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            <FiSettings style={{ marginRight: '12px', color: 'var(--blue-ice)' }} />
            Site Settings
          </h1>
          <p className={styles.subtitle}>
            Configure global site settings and integrations
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        {settingsGroups.map((group) => (
          <div key={group.title} className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>
                <span style={{ color: 'var(--blue-ice)' }}>{group.icon}</span>
                {group.title}
              </h2>
            </div>
            <div className={styles.cardContent}>
              {group.items.map((item, index) => (
                <div
                  key={item.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 'var(--space-3) 0',
                    borderBottom: index < group.items.length - 1 ? '1px solid var(--glass-border)' : 'none',
                  }}
                >
                  <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{item.value}</span>
                    {item.badge && (
                      <span
                        style={{
                          padding: '2px 8px',
                          background: item.badge === 'success' ? 'rgba(34, 197, 94, 0.2)' : 'var(--glass-2)',
                          color: item.badge === 'success' ? 'var(--status-success)' : 'var(--text-muted)',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          borderRadius: 'var(--radius-full)',
                          textTransform: 'uppercase',
                        }}
                      >
                        {item.badge === 'success' ? 'Active' : item.badge}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
