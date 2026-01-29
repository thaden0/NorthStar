import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { DashboardLayout } from '@/components/layout';
import { SettingsProvider } from '@/components/providers/SettingsProvider';
import { getSiteSettings } from '@/server/settings/actions';

export default async function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  
  if (!session) {
    redirect('/login');
  }

  // Fetch site settings for the provider
  const settings = await getSiteSettings();

  return (
    <SettingsProvider initialSettings={settings}>
      <DashboardLayout user={session.user}>
        {children}
      </DashboardLayout>
    </SettingsProvider>
  );
}
