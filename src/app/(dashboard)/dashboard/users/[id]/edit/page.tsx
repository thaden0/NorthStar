import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getSession, isSuperAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { FiArrowLeft, FiEdit } from 'react-icons/fi';
import UserEditForm from './UserEditForm';
import styles from './user-edit.module.css';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getUser(id: string) {
  const user = await db.user.findUnique({
    where: { id },
    include: {
      roles: {
        include: {
          role: true,
        },
      },
    },
  });
  return user;
}

async function getAllRoles() {
  return db.role.findMany({
    orderBy: { name: 'asc' },
  });
}

export default async function UserEditPage({ params }: PageProps) {
  const session = await getSession();
  
  if (!session || !isSuperAdmin(session)) {
    redirect('/dashboard');
  }

  const { id } = await params;
  const [user, allRoles] = await Promise.all([
    getUser(id),
    getAllRoles(),
  ]);

  if (!user) {
    notFound();
  }

  const isCurrentUser = user.id === session.userId;

  return (
    <div style={{ padding: 'var(--space-6)' }}>
      <Link href="/dashboard/users" className={styles.backLink}>
        <FiArrowLeft />
        Back to Users
      </Link>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
        <FiEdit style={{ fontSize: '1.5rem', color: 'var(--blue-ice)' }} />
        <h1 style={{ margin: 0, fontSize: '1.75rem' }}>Edit User</h1>
      </div>

      <UserEditForm 
        user={user} 
        allRoles={allRoles} 
        isCurrentUser={isCurrentUser}
      />
    </div>
  );
}
