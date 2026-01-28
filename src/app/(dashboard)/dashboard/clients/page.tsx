import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import ClientsClient from './ClientsClient';
import { getClientsAction, getProjectsAction } from '@/server/timeTracking/actions';
import { getSession, isSuperAdmin } from '@/lib/auth';
import type { Client, ClientProject } from '@/types/timeTracking';

export const metadata = {
  title: 'Clients | North Star',
  description: 'Manage your clients and projects',
};

async function getInitialData() {
  const [clientsResult, projectsResult] = await Promise.all([
    getClientsAction(),
    getProjectsAction(),
  ]);

  return {
    clients: (clientsResult.data as Client[]) || [],
    projects: (projectsResult.data as ClientProject[]) || [],
  };
}

export default async function ClientsPage() {
  // Check Super Admin access
  const session = await getSession();
  if (!session || !isSuperAdmin(session)) {
    redirect('/dashboard');
  }

  const { clients, projects } = await getInitialData();

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ClientsClient initialClients={clients} initialProjects={projects} />
    </Suspense>
  );
}
