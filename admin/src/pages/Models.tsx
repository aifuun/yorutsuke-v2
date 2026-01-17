/**
 * Admin Models Page - LLM Model Selection
 */

import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { ProcessingSettings } from '../components/ProcessingSettings';
import { api, endpoints } from '../api/client';
import type { BatchConfig } from '../types/batch';

export function Models() {
  const [config, setConfig] = useState<BatchConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const configData = await api.get<BatchConfig>(endpoints.batchConfig);
      setConfig(configData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch configuration');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-app-text">Recognition Models</h1>
            <p className="text-app-text-secondary mt-1">
              Configure which AI service to use for receipt processing
            </p>
          </div>
          <button
            onClick={fetchConfig}
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

        {/* Processing Settings */}
        {config && (
          <ProcessingSettings
            config={config}
            onSave={(newConfig) => setConfig(newConfig)}
          />
        )}
      </div>
    </Layout>
  );
}
