'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { FiCheck, FiCpu, FiClock, FiActivity, FiDatabase, FiZap, FiDownload, FiLoader } from 'react-icons/fi';
import { OllamaModel, ModelStats } from '@/lib/agent-service';
import styles from './ai-settings.module.css';

interface AISettingsClientProps {
  models: OllamaModel[];
  currentModel: string;
  modelStats: ModelStats[];
  agentServiceOnline: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function AISettingsClient({
  models,
  currentModel,
  modelStats,
  agentServiceOnline,
}: AISettingsClientProps) {
  const router = useRouter();
  const [selectedModel, setSelectedModel] = useState(currentModel);
  const [isPending, startTransition] = useTransition();
  const [pullModelName, setPullModelName] = useState('');
  const [isPulling, setIsPulling] = useState(false);

  const handleSelectModel = async (modelName: string) => {
    if (modelName === selectedModel) return;
    
    startTransition(async () => {
      try {
        const res = await fetch('/api/agent/settings/default-model', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: modelName }),
        });
        
        if (!res.ok) throw new Error('Failed to update model');
        
        setSelectedModel(modelName);
        toast.success(`Default model changed to ${modelName}`);
      } catch {
        toast.error('Failed to update default model');
      }
    });
  };

  const handlePullModel = async () => {
    if (!pullModelName.trim()) {
      toast.error('Please enter a model name');
      return;
    }

    setIsPulling(true);
    toast.info(`Pulling model ${pullModelName}... This may take several minutes for large models.`);

    try {
      const res = await fetch('/api/agent/settings/pull-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: pullModelName.trim() }),
      });
      
      const result = await res.json();
      
      if (result.success) {
        toast.success(result.message || `Model ${pullModelName} pulled successfully!`);
        setPullModelName('');
        // Refresh the page to show new model
        router.refresh();
      } else {
        toast.error(result.error || result.message || 'Failed to pull model');
      }
    } catch {
      toast.error('Failed to pull model. Check if the model name is correct.');
    } finally {
      setIsPulling(false);
    }
  };

  const getStatsForModel = (modelName: string): ModelStats | undefined => {
    return modelStats.find(s => s.modelName === modelName);
  };

  const selectedStats = getStatsForModel(selectedModel);

  return (
    <div className={styles.container}>
      {/* Service Status */}
      <div className={styles.statsCard}>
        <div className={styles.statsHeader}>
          <h3>
            <FiActivity />
            Agent Service Status
          </h3>
          <span className={agentServiceOnline ? styles.statusOnline : styles.statusOffline}>
            {agentServiceOnline ? '● Online' : '○ Offline'}
          </span>
        </div>
      </div>

      {/* Model Selection */}
      <div className={styles.statsCard}>
        <div className={styles.statsHeader}>
          <h3>
            <FiCpu />
            Select AI Model
          </h3>
        </div>
        <div className={styles.statsContent}>
          {!agentServiceOnline ? (
            <div className={styles.noStats}>
              <p>Agent Service is offline. Cannot load models.</p>
            </div>
          ) : models.length === 0 ? (
            <div className={styles.noStats}>
              <p>No models available in Ollama.</p>
              <p>Pull models using: <code>ollama pull llama3.2</code></p>
            </div>
          ) : (
            <div className={styles.modelGrid}>
              {models.map((model) => {
                const stats = getStatsForModel(model.name);
                return (
                  <div
                    key={model.name}
                    className={`${styles.modelCard} ${selectedModel === model.name ? styles.selected : ''}`}
                    onClick={() => handleSelectModel(model.name)}
                    style={{ opacity: isPending ? 0.7 : 1 }}
                  >
                    {selectedModel === model.name && (
                      <div className={styles.checkIcon}>
                        <FiCheck size={14} />
                      </div>
                    )}
                    <div className={styles.modelName}>
                      {model.name}
                    </div>
                    <div className={styles.modelMeta}>
                      <span className={styles.metaItem}>
                        <FiDatabase size={12} />
                        {formatBytes(model.size)}
                      </span>
                      {model.details?.parameter_size && (
                        <span className={styles.tag}>
                          {model.details.parameter_size}
                        </span>
                      )}
                      {model.details?.quantization_level && (
                        <span className={styles.tag}>
                          {model.details.quantization_level}
                        </span>
                      )}
                      {stats && (
                        <span className={styles.metaItem}>
                          <FiClock size={12} />
                          ~{formatMs(stats.averageResponseTimeMs)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Pull New Model */}
      {agentServiceOnline && (
        <div className={styles.statsCard}>
          <div className={styles.statsHeader}>
            <h3>
              <FiDownload />
              Pull New Model
            </h3>
          </div>
          <div className={styles.statsContent}>
            <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }}>
              Download a new model from the Ollama registry. Popular models include: 
              <code style={{ margin: '0 4px' }}>llama3.2</code>, 
              <code style={{ margin: '0 4px' }}>mistral</code>, 
              <code style={{ margin: '0 4px' }}>codellama</code>, 
              <code style={{ margin: '0 4px' }}>phi3</code>
            </p>
            <div className={styles.pullModelForm}>
              <input
                type="text"
                value={pullModelName}
                onChange={(e) => setPullModelName(e.target.value)}
                placeholder="Enter model name (e.g., llama3.2:3b)"
                className={styles.pullModelInput}
                disabled={isPulling}
                onKeyDown={(e) => e.key === 'Enter' && handlePullModel()}
              />
              <button
                onClick={handlePullModel}
                disabled={isPulling || !pullModelName.trim()}
                className={styles.pullModelButton}
              >
                {isPulling ? (
                  <>
                    <FiLoader className={styles.spinning} />
                    Pulling...
                  </>
                ) : (
                  <>
                    <FiDownload />
                    Pull Model
                  </>
                )}
              </button>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 'var(--space-3)' }}>
              Note: Large models can take several minutes to download. Check the Ollama server logs for progress.
            </p>
          </div>
        </div>
      )}
      {/* Selected Model Stats */}
      <div className={styles.statsCard}>
        <div className={styles.statsHeader}>
          <h3>
            <FiZap />
            Model Analytics: {selectedModel}
          </h3>
        </div>
        <div className={styles.statsContent}>
          {!selectedStats ? (
            <div className={styles.noStats}>
              <p>No analytics data yet for this model.</p>
              <p>Start using the AI Insights chat to collect performance data.</p>
            </div>
          ) : (
            <div className={styles.statsGrid}>
              <div className={styles.statItem}>
                <div className={styles.statValue}>{selectedStats.totalRequests}</div>
                <div className={styles.statLabel}>Total Requests</div>
              </div>
              <div className={styles.statItem}>
                <div className={styles.statValue}>{formatMs(selectedStats.averageResponseTimeMs)}</div>
                <div className={styles.statLabel}>Avg Response Time</div>
              </div>
              <div className={styles.statItem}>
                <div className={styles.statValue}>{formatMs(selectedStats.minResponseTimeMs)}</div>
                <div className={styles.statLabel}>Min Response</div>
              </div>
              <div className={styles.statItem}>
                <div className={styles.statValue}>{formatMs(selectedStats.maxResponseTimeMs)}</div>
                <div className={styles.statLabel}>Max Response</div>
              </div>
              <div className={styles.statItem}>
                <div className={styles.statValue}>
                  {selectedStats.totalRequests > 0 
                    ? Math.round((selectedStats.successfulRequests / selectedStats.totalRequests) * 100) 
                    : 0}%
                </div>
                <div className={styles.statLabel}>Success Rate</div>
              </div>
              <div className={styles.statItem}>
                <div className={styles.statValue}>
                  {selectedStats.totalTokens.toLocaleString()}
                </div>
                <div className={styles.statLabel}>Total Tokens</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
