import { Metadata } from 'next';
import { getScheduledTasks } from '@/server/notifications/actions';
import ScheduledTasksList from './ScheduledTasksList';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Scheduled Tasks | North Star',
  description: 'Manage your scheduled AI tasks',
};

export default async function ScheduledTasksPage() {
  const tasks = await getScheduledTasks();

  return (
    <div>
      <ScheduledTasksList initialTasks={tasks} />
    </div>
  );
}
