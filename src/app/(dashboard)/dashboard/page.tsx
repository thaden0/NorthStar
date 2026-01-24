import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { FiUsers, FiFolder, FiFileText, FiCpu, FiTrendingUp, FiActivity } from 'react-icons/fi';
import styles from './dashboard.module.css';

export const dynamic = 'force-dynamic';

async function getStats() {
  const [usersCount, filesCount, logsCount, insightsCount] = await Promise.all([
    db.user.count(),
    db.file.count(),
    db.log.count(),
    db.aIInsight.count({ where: { status: 'unread' } }),
  ]);

  return { usersCount, filesCount, logsCount, insightsCount };
}

export default async function DashboardPage() {
  const session = await getSession();
  const stats = await getStats();

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            {greeting()}, <span className={styles.gradient}>{session?.user.name.split(' ')[0]}</span>
          </h1>
          <p className={styles.subtitle}>
            Welcome to your North Star dashboard
          </p>
        </div>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #3B82F6, #2563EB)' }}>
            <FiUsers />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statValue}>{stats.usersCount}</span>
            <span className={styles.statLabel}>Total Users</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)' }}>
            <FiFolder />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statValue}>{stats.filesCount}</span>
            <span className={styles.statLabel}>Files Uploaded</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #22D3EE, #0891B2)' }}>
            <FiCpu />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statValue}>{stats.insightsCount}</span>
            <span className={styles.statLabel}>New Insights</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #F472B6, #DB2777)' }}>
            <FiFileText />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statValue}>{stats.logsCount}</span>
            <span className={styles.statLabel}>Log Entries</span>
          </div>
        </div>
      </div>

      <div className={styles.gridContainer}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>
              <FiActivity className={styles.cardIcon} />
              Quick Actions
            </h2>
          </div>
          <div className={styles.cardContent}>
            <div className={styles.actionGrid}>
              <a href="/dashboard/files" className={styles.actionCard}>
                <FiFolder className={styles.actionIcon} />
                <span>Manage Files</span>
              </a>
              <a href="/dashboard/ai-insights" className={styles.actionCard}>
                <FiCpu className={styles.actionIcon} />
                <span>View Insights</span>
              </a>
              <a href="/dashboard/portfolio" className={styles.actionCard}>
                <FiTrendingUp className={styles.actionIcon} />
                <span>Edit Portfolio</span>
              </a>
              <a href="/dashboard/settings" className={styles.actionCard}>
                <FiUsers className={styles.actionIcon} />
                <span>Settings</span>
              </a>
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>
              <FiTrendingUp className={styles.cardIcon} />
              System Status
            </h2>
          </div>
          <div className={styles.cardContent}>
            <div className={styles.statusList}>
              <div className={styles.statusItem}>
                <span className={styles.statusDot} style={{ background: 'var(--status-success)' }} />
                <span>Database</span>
                <span className={styles.statusBadge}>Healthy</span>
              </div>
              <div className={styles.statusItem}>
                <span className={styles.statusDot} style={{ background: 'var(--status-success)' }} />
                <span>Authentication</span>
                <span className={styles.statusBadge}>Active</span>
              </div>
              <div className={styles.statusItem}>
                <span className={styles.statusDot} style={{ background: 'var(--status-success)' }} />
                <span>File Storage</span>
                <span className={styles.statusBadge}>Online</span>
              </div>
              <div className={styles.statusItem}>
                <span className={styles.statusDot} style={{ background: 'var(--status-success)' }} />
                <span>AI Service</span>
                <span className={styles.statusBadge}>Ready</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
