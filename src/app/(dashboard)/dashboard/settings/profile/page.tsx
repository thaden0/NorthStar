import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { FiUser } from 'react-icons/fi';
import { db } from '@/lib/db';
import ProfileForm from './ProfileForm';
import GoogleIntegration from './GoogleIntegration';
import styles from './profile.module.css';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const session = await getSession();
  
  if (!session) {
    redirect('/login');
  }

  // Fetch full user data including aiInstructions
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      aiInstructions: true,
    },
  });

  if (!user) {
    redirect('/login');
  }

  return (
    <div className={styles.container} style={{ padding: 'var(--space-6)', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h1 style={{ fontSize: '2rem', display: 'flex', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
          <FiUser style={{ marginRight: '12px', color: 'var(--blue-ice)' }} />
          <span>Profile Settings</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>
          Manage your account information and connected services
        </p>
      </div>

      <ProfileForm
        user={{
          id: user.id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          aiInstructions: user.aiInstructions,
        }}
      />

      {/* Google Integration Section */}
      <div style={{ marginTop: 'var(--space-6)' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-4)', color: 'var(--text-primary)' }}>
          Connected Services
        </h2>
        <GoogleIntegration />
      </div>
    </div>
  );
}
