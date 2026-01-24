import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { FiUser } from 'react-icons/fi';
import ProfileForm from './ProfileForm';
import styles from '../page.module.css';

export default async function ProfilePage() {
  const session = await getSession();
  
  if (!session) {
    redirect('/login');
  }

  return (
    <div className={styles?.page || ''} style={{ padding: 'var(--space-6)', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h1 style={{ fontSize: '2rem', display: 'flex', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
          <FiUser style={{ marginRight: '12px', color: 'var(--blue-ice)' }} />
          <span>Profile Settings</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>
          Manage your account information and password
        </p>
      </div>

      <ProfileForm
        user={{
          id: session.userId,
          name: session.user.name,
          email: session.user.email,
          avatar: session.user.avatar,
        }}
      />
    </div>
  );
}
