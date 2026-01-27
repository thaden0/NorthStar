import { redirect } from 'next/navigation';
import { getSession, isAdmin } from '@/lib/auth';
import LogsClient from './LogsClient';

export const dynamic = 'force-dynamic';

export default async function LogsPage() {
  const session = await getSession();
  
  if (!session || !isAdmin(session)) {
    redirect('/dashboard');
  }

  return <LogsClient />;
}
