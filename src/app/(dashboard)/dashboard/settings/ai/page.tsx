import { redirect } from 'next/navigation';
import { getSession, isSuperAdmin } from '@/lib/auth';
import { createAgentClient, OllamaModel, ModelStats } from '@/lib/agent-service';
import { FiCpu } from 'react-icons/fi';
import AISettingsClient from './AISettingsClient';
import styles from '../../dashboard.module.css';

export const dynamic = 'force-dynamic';

async function getAIData(userId: string) {
  const client = createAgentClient(userId);
  
  let models: OllamaModel[] = [];
  let currentModel = 'llama3.2';
  let modelStats: ModelStats[] = [];
  let agentServiceOnline = false;

  try {
    // Check if service is online
    await client.healthCheck();
    agentServiceOnline = true;
    
    // Fetch all data in parallel
    const [modelsResult, defaultModel, stats] = await Promise.all([
      client.getModels().catch(() => []),
      client.getDefaultModel().catch(() => 'llama3.2'),
      client.getAllModelStats().catch(() => []),
    ]);

    models = modelsResult;
    currentModel = defaultModel;
    modelStats = stats;
  } catch {
    // Service offline - that's okay, we'll show offline status
  }

  return { models, currentModel, modelStats, agentServiceOnline };
}

export default async function AISettingsPage() {
  const session = await getSession();
  
  if (!session || !isSuperAdmin(session)) {
    redirect('/dashboard');
  }

  const { models, currentModel, modelStats, agentServiceOnline } = await getAIData(session.userId);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            <FiCpu style={{ marginRight: '12px', color: 'var(--purple-neon)' }} />
            AI Settings
          </h1>
          <p className={styles.subtitle}>
            Configure AI models and view performance analytics
          </p>
        </div>
      </div>

      <AISettingsClient
        models={models}
        currentModel={currentModel}
        modelStats={modelStats}
        agentServiceOnline={agentServiceOnline}
      />
    </div>
  );
}
