/**
 * Admin Batch Page - Batch Processing Monitoring
 */

import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { StatCard } from '../components/StatCard';
import { ProcessingSettings } from '../components/ProcessingSettings';
import { api, endpoints } from '../api/client';
import type { BatchConfig } from '../types/batch';

// Mode display configuration
const MODE_CONFIG = {
  instant: {
    label: 'Instant',
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    borderColor: 'border-green-500/30',
    icon: '⚡',
    description: 'Receipts are processed immediately after upload',
    triggerAction: 'Force reprocess any failed images',
  },
  batch: {
    label: 'Batch Only',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/20',
    borderColor: 'border-amber-500/30',
    icon: '📦',
    description: 'Images queued until threshold (≥100) is reached',
    triggerAction: 'Process all queued images now (uses Batch API)',
  },
  hybrid: {
    label: 'Hybrid',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500/30',
    icon: '🔄',
    description: 'Batch when threshold met, Instant on timeout',
    triggerAction: 'Process queued images via Instant API',
  },
} as const;

interface BatchStatus {
  pendingImages: {
    pending: number;
    isTruncated: boolean;
  };
  lastResult: {
    processed: number;
    failed: number;
    timestamp: string;
  } | null;
  recentLogs: Array<{
    timestamp: string;
    message: string;
  }>;
  scheduledTime: string;
  lambdaName: string;
}

export function Batch() {
  const [status, setStatus] = useState<BatchStatus | null>(null);
  const [config, setConfig] = useState<BatchConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTriggering, setIsTriggering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [statusData, configData] = await Promise.all([
        api.get<BatchStatus>(endpoints.batch),
        api.get<BatchConfig>(endpoints.batchConfig)
      ]);
      setStatus(statusData);
      setConfig(configData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch batch data');
    } finally {
      setIsLoading(false);
    }
  };

  const triggerBatch = async () => {
    setIsTriggering(true);
    setError(null);
    try {
      await api.post(endpoints.batch, { action: 'trigger' });
      setShowConfirm(false);
      // Wait a moment then refresh data
      setTimeout(fetchData, 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to trigger batch');
    } finally {
      setIsTriggering(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-app-text">Receipt Processing</h1>
              {config && (
                <span className={`text-sm px-2.5 py-1 rounded-full ${MODE_CONFIG[config.processingMode].bgColor} ${MODE_CONFIG[config.processingMode].color} ${MODE_CONFIG[config.processingMode].borderColor} border font-medium`}>
                  {MODE_CONFIG[config.processingMode].icon} {MODE_CONFIG[config.processingMode].label} Mode
                </span>
              )}
            </div>
            <p className="text-app-text-secondary mt-1">
              {config ? MODE_CONFIG[config.processingMode].description : 'Configure and monitor OCR processing'}
            </p>
          </div>
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="px-4 py-2 text-sm bg-app-surface border border-app-border rounded-lg
                       hover:bg-app-border transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Stats Grid */}
        {status && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <StatCard
                title="Queued Images"
                value={status.pendingImages.pending}
                subtitle={
                  status.pendingImages.pending === 0
                    ? 'No images waiting'
                    : status.pendingImages.isTruncated
                      ? '100+ images in queue'
                      : config?.processingMode === 'instant'
                        ? 'Will process on next upload'
                        : `Threshold: ${config?.imageThreshold ?? 100}`
                }
                icon="📋"
                color={status.pendingImages.pending > 0 ? 'yellow' : 'green'}
              />
              <StatCard
                title="Last Run"
                value={status.lastResult?.processed ?? '-'}
                subtitle={
                  status.lastResult?.timestamp
                    ? `${new Date(status.lastResult.timestamp).toLocaleString()}`
                    : 'No processing history'
                }
                icon="✅"
                color="green"
              />
              <StatCard
                title="Failed"
                value={status.lastResult?.failed ?? 0}
                subtitle={
                  !status.lastResult
                    ? 'No errors recorded'
                    : status.lastResult.failed > 0
                      ? 'Requires attention'
                      : 'All succeeded'
                }
                icon={status.lastResult?.failed && status.lastResult.failed > 0 ? '⚠️' : '✓'}
                color={status.lastResult?.failed && status.lastResult.failed > 0 ? 'red' : 'green'}
              />
            </div>

            {/* Processing Settings */}
            {config && (
              <ProcessingSettings
                config={config}
                onSave={(newConfig) => setConfig(newConfig)}
              />
            )}

            {/* Manual Trigger Section */}
            <div className="bg-app-surface border border-app-border rounded-lg p-6 mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-app-text">Manual Processing</h3>
                  <p className="text-app-text-secondary">
                    {config ? MODE_CONFIG[config.processingMode].triggerAction : 'Trigger processing manually'}
                  </p>
                  <p className="text-xs text-app-text-secondary mt-2 font-mono">
                    Lambda: {status.lambdaName}
                  </p>
                </div>
                {status.pendingImages.pending === 0 && config?.processingMode === 'instant' ? (
                  <div className="text-app-text-secondary text-sm px-6 py-3 bg-app-bg rounded-lg">
                    No queued images to process
                  </div>
                ) : !showConfirm ? (
                  <button
                    onClick={() => setShowConfirm(true)}
                    className="px-6 py-3 bg-app-accent text-white rounded-lg
                               hover:bg-app-accent/80 transition-colors font-medium"
                  >
                    {config?.processingMode === 'instant' ? 'Reprocess Failed' : 'Process Now'}
                  </button>
                ) : (
                  <div className="flex gap-3">
                    <button
                      onClick={triggerBatch}
                      disabled={isTriggering}
                      className="px-6 py-3 bg-amber-600 text-white rounded-lg
                                 hover:bg-amber-700 transition-colors font-medium disabled:opacity-50"
                    >
                      {isTriggering ? 'Processing...' : 'Confirm'}
                    </button>
                    <button
                      onClick={() => setShowConfirm(false)}
                      disabled={isTriggering}
                      className="px-6 py-3 bg-app-border text-app-text rounded-lg
                                 hover:bg-app-text-secondary/20 transition-colors font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Logs */}
            <div>
              <h2 className="text-lg font-semibold text-app-text mb-4">Recent Logs</h2>
              <div className="bg-app-surface border border-app-border rounded-lg overflow-hidden">
                <div className="max-h-96 overflow-y-auto">
                  {status.recentLogs.length === 0 ? (
                    <div className="p-8 text-center text-app-text-secondary">
                      No recent logs available
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-app-bg/50 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left text-app-text-secondary font-medium w-48">
                            Timestamp
                          </th>
                          <th className="px-4 py-2 text-left text-app-text-secondary font-medium">
                            Message
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {status.recentLogs.map((log, index) => (
                          <tr key={index} className="border-t border-app-border hover:bg-app-bg/30">
                            <td className="px-4 py-2 text-app-text-secondary whitespace-nowrap">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </td>
                            <td className="px-4 py-2 text-app-text font-mono text-xs break-all">
                              {log.message}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Info Box */}
        <div className="mt-6 p-4 bg-app-surface border border-app-border rounded-lg">
          <h3 className="text-sm font-medium text-app-text mb-3">Processing Modes Explained</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <div className="font-medium text-green-400 mb-1">⚡ Instant Mode</div>
              <div className="text-app-text-secondary text-xs">
                Process immediately after upload. Best UX, standard pricing.
              </div>
            </div>
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <div className="font-medium text-amber-400 mb-1">📦 Batch Only</div>
              <div className="text-app-text-secondary text-xs">
                Queue until 100+ images, then batch process. 50% cost savings.
              </div>
            </div>
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <div className="font-medium text-blue-400 mb-1">🔄 Hybrid</div>
              <div className="text-app-text-secondary text-xs">
                Try Batch first, fallback to Instant if timeout reached.
              </div>
            </div>
          </div>
          <p className="text-xs text-app-text-secondary mt-3">
            LLM options: Nova Lite (low cost), Nova Pro (higher accuracy), Claude 3 Haiku (alternative)
          </p>
        </div>
      </div>
    </Layout>
  );
}
