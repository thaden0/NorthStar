import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import ChatClient from './ChatClient';

export const dynamic = 'force-dynamic';

export default async function AIInsightsPage() {
  const session = await getSession();
  
  if (!session) {
    redirect('/login');
  }

  return (
    <ChatClient 
      userId={session.user.id}
      userName={session.user.name}
      userEmail={session.user.email}
    />
  );
}
