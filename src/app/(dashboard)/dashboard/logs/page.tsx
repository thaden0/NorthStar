import { redirect } from 'next/navigation';
import { getSession, isAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { FiFileText, FiInfo, FiAlertTriangle, FiAlertCircle, FiFilter } from 'react-icons/fi';
import styles from '../dashboard.module.css';

export const dynamic = 'force-dynamic';

async function getLogs(): Promise<{
  id: string;
  level: string;
  message: string;
  metadata: unknown;
  createdAt: Date;
  userId: string | null;
  user: {
    name: string;
    email: string;
  } | null;
}[]> {
  const logs = await db.log.findMany({
    include: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return logs;
}

export default async function LogsPage() {
  const session = await getSession();
  
  if (!session || !isAdmin(session)) {
    redirect('/dashboard');
  }

  const logs = await getLogs();

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error':
        return <FiAlertCircle style={{ color: 'var(--status-error)' }} />;
      case 'warn':
        return <FiAlertTriangle style={{ color: 'var(--status-warning)' }} />;
      default:
        return <FiInfo style={{ color: 'var(--blue-ice)' }} />;
    }
  };

  const getLevelBadge = (level: string) => {
    const colors = {
      error: { bg: 'rgba(239, 68, 68, 0.2)', color: 'var(--status-error)' },
      warn: { bg: 'rgba(245, 158, 11, 0.2)', color: 'var(--status-warning)' },
      info: { bg: 'rgba(59, 130, 246, 0.2)', color: 'var(--blue-ice)' },
    };
    const style = colors[level as keyof typeof colors] || colors.info;
    
    return (
      <span
        style={{
          padding: '4px 10px',
          background: style.bg,
          color: style.color,
          fontSize: '0.75rem',
          fontWeight: 600,
          borderRadius: 'var(--radius-full)',
          textTransform: 'uppercase',
        }}
      >
        {level}
      </span>
    );
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            <FiFileText style={{ marginRight: '12px', color: 'var(--magenta-glow)' }} />
            System Logs
          </h1>
          <p className={styles.subtitle}>
            View system activity and error logs
          </p>
        </div>
        <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FiFilter /> Filter
        </button>
      </div>

      {logs.length === 0 ? (
        <div className={styles.card}>
          <div className={styles.cardContent} style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
            <FiFileText style={{ fontSize: '3rem', color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }} />
            <h3 style={{ marginBottom: 'var(--space-2)' }}>No Logs Yet</h3>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>
              System activity logs will appear here.
            </p>
          </div>
        </div>
      ) : (
        <div className={styles.card}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                  <th style={{ padding: 'var(--space-4)', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.875rem', width: '100px' }}>Level</th>
                  <th style={{ padding: 'var(--space-4)', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.875rem' }}>Message</th>
                  <th style={{ padding: 'var(--space-4)', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.875rem', width: '150px' }}>User</th>
                  <th style={{ padding: 'var(--space-4)', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.875rem', width: '180px' }}>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                    <td style={{ padding: 'var(--space-4)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        {getLevelIcon(log.level)}
                        {getLevelBadge(log.level)}
                      </div>
                    </td>
                    <td style={{ padding: 'var(--space-4)', color: 'var(--text-secondary)' }}>
                      {log.message}
                    </td>
                    <td style={{ padding: 'var(--space-4)', color: 'var(--text-muted)' }}>
                      {log.user?.name || 'System'}
                    </td>
                    <td style={{ padding: 'var(--space-4)', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
