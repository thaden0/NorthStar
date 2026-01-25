import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession, isSuperAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { FiUsers, FiMail, FiShield, FiEdit, FiTrash2 } from 'react-icons/fi';
import styles from '../dashboard.module.css';

export const dynamic = 'force-dynamic';

async function getUsers() {
  const users = await db.user.findMany({
    include: {
      roles: {
        include: {
          role: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  return users;
}

export default async function UsersPage() {
  const session = await getSession();
  
  if (!session || !isSuperAdmin(session)) {
    redirect('/dashboard');
  }

  const users = await getUsers();

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            <FiUsers style={{ marginRight: '12px', color: 'var(--cyan-glow)' }} />
            Users
          </h1>
          <p className={styles.subtitle}>
            Manage system users and their roles
          </p>
        </div>
        <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FiUsers /> Invite User
        </button>
      </div>

      <div className={styles.card}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                <th style={{ padding: 'var(--space-4)', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.875rem' }}>User</th>
                <th style={{ padding: 'var(--space-4)', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.875rem' }}>Email</th>
                <th style={{ padding: 'var(--space-4)', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.875rem' }}>Roles</th>
                <th style={{ padding: 'var(--space-4)', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.875rem' }}>Joined</th>
                <th style={{ padding: 'var(--space-4)', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.875rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                  <td style={{ padding: 'var(--space-4)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          background: 'var(--gradient-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 600,
                          color: 'white',
                          flexShrink: 0,
                        }}
                      >
                        {user.avatar ? (
                          <img
                            src={user.avatar}
                            alt={user.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                          />
                        ) : (
                          user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                        )}
                      </div>
                      <span style={{ fontWeight: 500 }}>{user.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: 'var(--space-4)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--text-muted)' }}>
                      <FiMail style={{ fontSize: '0.875rem' }} />
                      <span>{user.email}</span>
                    </div>
                  </td>
                  <td style={{ padding: 'var(--space-4)' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                      {user.roles.map((r) => (
                        <span
                          key={r.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 10px',
                            background: r.role.name === 'Super Admin' ? 'rgba(139, 92, 246, 0.2)' : 'var(--glass-2)',
                            color: r.role.name === 'Super Admin' ? 'var(--purple-neon)' : 'var(--text-secondary)',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            borderRadius: 'var(--radius-full)',
                          }}
                        >
                          <FiShield style={{ fontSize: '0.7rem' }} />
                          {r.role.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: 'var(--space-4)', color: 'var(--text-muted)' }}>
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: 'var(--space-4)', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                      <Link
                        href={`/dashboard/users/${user.id}/edit`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '32px',
                          height: '32px',
                          background: 'var(--glass-2)',
                          border: '1px solid var(--glass-border)',
                          borderRadius: 'var(--radius-md)',
                          color: 'var(--blue-ice)',
                          cursor: 'pointer',
                          textDecoration: 'none',
                        }}
                      >
                        <FiEdit />
                      </Link>
                      <button
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '32px',
                          height: '32px',
                          background: 'var(--glass-2)',
                          border: '1px solid var(--glass-border)',
                          borderRadius: 'var(--radius-md)',
                          color: 'var(--status-error)',
                          cursor: 'pointer',
                        }}
                        disabled={user.id === session.userId}
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
