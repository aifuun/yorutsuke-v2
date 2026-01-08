/**
 * Admin Batch Page - Batch Processing Monitoring
 */

import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { StatCard } from '../components/StatCard';
import { ProcessingSettings } from '../components/ProcessingSettings';
import { api, endpoints } from '../api/client';
import { BatchConfig } from '../types/batch';

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
            <h1 className="text-2xl font-bold text-app-text">Batch Processing</h1>
            <p className="text-app-text-secondary mt-1">
              Monitor and trigger batch OCR processing
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
                title="Pending Images"
                value={status.pendingImages.pending}
                subtitle={status.pendingImages.isTruncated ? 'More than shown' : 'In uploads/ folder'}
                icon="🖼️"
                color="blue"
              />
              <StatCard
                title="Last Processed"
                value={status.lastResult?.processed ?? '-'}
                subtitle={status.lastResult?.timestamp ? new Date(status.lastResult.timestamp).toLocaleString() : 'No recent runs'}
                icon="✅"
                color="green"
              />
              <StatCard
                title="Last Failed"
                value={status.lastResult?.failed ?? '-'}
                subtitle="In last batch run"
                icon={status.lastResult?.failed && status.lastResult.failed > 0 ? '❌' : '✅'}
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

            {/* Schedule Info */}
            <div className="bg-app-surface border border-app-border rounded-lg p-6 mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-app-text">Scheduled Run</h3>
                  <p className="text-app-text-secondary">
                    Daily at {status.scheduledTime}
                  </p>
                  <p className="text-sm text-app-text-secondary mt-1">
                    Lambda: {status.lambdaName}
                  </p>
                </div>
                {!showConfirm ? (
                  <button
                    onClick={() => setShowConfirm(true)}
                    className="px-6 py-3 bg-app-accent text-white rounded-lg
                               hover:bg-app-accent/80 transition-colors font-medium"
                  >
                    Trigger Manually
                  </button>
                ) : (
                  <div className="flex gap-3">
                    <button
                      onClick={triggerBatch}
                      disabled={isTriggering}
                      className="px-6 py-3 bg-amber-600 text-white rounded-lg
                                 hover:bg-amber-700 transition-colors font-medium disabled:opacity-50"
                    >
                      {isTriggering ? 'Triggering...' : 'Confirm Trigger'}
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
          <h3 className="text-sm font-medium text-app-text mb-2">About Batch Processing</h3>
          <ul className="text-sm text-app-text-secondary space-y-1 list-disc list-inside">
            <li>Runs automatically every day at 02:00 JST (17:00 UTC)</li>
            <li>In <b>Batch Mode</b>, processing is deferred until threshold (100) is met</li>
            <li>In <b>Hybrid Mode</b>, deferred images are processed via Instant if threshold not met by report time</li>
            <li>Processing mode and LLM models can be configured above</li>
            <li>Results are written to the transactions table</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
}
