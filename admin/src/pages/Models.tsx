/**
 * Admin Models Page - Recognition Service Configuration
 */

import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { ModelSelection } from '../components/ModelSelection';
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
      const configData = await api.get<BatchConfig>(endpoints.modelConfig);
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

        {/* Model Selection */}
        {config && (
          <ModelSelection
            config={config}
            onSave={(newConfig) => setConfig(newConfig)}
          />
        )}

        {/* Info Section */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-app-surface border border-app-border rounded-lg p-6">
            <h3 className="text-lg font-semibold text-app-text mb-3">🚀 Nova Lite</h3>
            <p className="text-sm text-app-text-secondary mb-3">
              AWS Bedrock Nova Lite model provides fast, cost-effective receipt processing.
            </p>
            <ul className="text-xs text-app-text-secondary space-y-1">
              <li>• Cost: ~¥0.015 per image</li>
              <li>• Speed: Fast (1-2s)</li>
              <li>• Accuracy: Good for simple receipts</li>
              <li>• Best for: High-volume processing</li>
            </ul>
          </div>

          <div className="bg-app-surface border border-app-border rounded-lg p-6">
            <h3 className="text-lg font-semibold text-app-text mb-3">⚡ Nova Pro</h3>
            <p className="text-sm text-app-text-secondary mb-3">
              AWS Bedrock Nova Pro model offers higher accuracy for complex receipts.
            </p>
            <ul className="text-xs text-app-text-secondary space-y-1">
              <li>• Cost: ~¥0.06 per image</li>
              <li>• Speed: Medium (2-3s)</li>
              <li>• Accuracy: Excellent for all receipts</li>
              <li>• Best for: Critical accuracy needs</li>
            </ul>
          </div>

          <div className="bg-app-surface border border-app-border rounded-lg p-6">
            <h3 className="text-lg font-semibold text-app-text mb-3">📄 Azure DI</h3>
            <p className="text-sm text-app-text-secondary mb-3">
              Azure Document Intelligence specialized receipt recognition service.
            </p>
            <ul className="text-xs text-app-text-secondary space-y-1">
              <li>• Cost: Varies by region</li>
              <li>• Speed: Medium (2-4s)</li>
              <li>• Accuracy: Specialized for receipts</li>
              <li>• Best for: Detailed line items</li>
            </ul>
          </div>
        </div>

        {/* Usage Notes */}
        <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <h3 className="text-sm font-medium text-blue-400 mb-2">💡 Usage Notes</h3>
          <ul className="text-xs text-app-text-secondary space-y-1">
            <li>• Changes take effect immediately for new uploads</li>
            <li>• Azure DI requires separate credential setup</li>
            <li>• Choose Nova Lite for cost optimization, Nova Pro for accuracy</li>
            <li>• All models support Japanese and English receipts</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
}
