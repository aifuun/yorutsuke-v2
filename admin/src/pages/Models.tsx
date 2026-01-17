/**
<<<<<<< HEAD
 * Admin Models Page - LLM Model Selection (Issue #149)
 * Dynamic model configuration without CDK redeployment
=======
 * Admin Models Page - Recognition Service Configuration
>>>>>>> c5f5fe9 (refactor: separate model selection into dedicated Models page)
 */

import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
<<<<<<< HEAD
import { api, endpoints } from '../api/client';
import type { ModelConfig } from '../types/batch';
import { AVAILABLE_MODELS } from '../types/batch';

export function Models() {
  const [currentConfig, setCurrentConfig] = useState<ModelConfig | null>(null);
  const [selectedTokenCode, setSelectedTokenCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
=======
import { ModelSelection } from '../components/ModelSelection';
import { api, endpoints } from '../api/client';
import type { BatchConfig } from '../types/batch';

export function Models() {
  const [config, setConfig] = useState<BatchConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
>>>>>>> c5f5fe9 (refactor: separate model selection into dedicated Models page)

  const fetchConfig = async () => {
    setIsLoading(true);
    setError(null);
    try {
<<<<<<< HEAD
      const config = await api.get<ModelConfig>(endpoints.modelConfig);
      setCurrentConfig(config);
      setSelectedTokenCode(config.tokenCode);
=======
      const configData = await api.get<BatchConfig>(endpoints.batchConfig);
      setConfig(configData);
>>>>>>> c5f5fe9 (refactor: separate model selection into dedicated Models page)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch configuration');
    } finally {
      setIsLoading(false);
    }
  };

<<<<<<< HEAD
  const handleSave = async () => {
    const selectedModel = AVAILABLE_MODELS.find(m => m.tokenCode === selectedTokenCode);
    if (!selectedModel) return;

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const result = await api.post<{ success: boolean; config: ModelConfig }>(
        endpoints.modelConfig,
        selectedModel
      );
      setCurrentConfig(result.config);
      setSuccessMessage('Model configuration saved successfully');
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

=======
>>>>>>> c5f5fe9 (refactor: separate model selection into dedicated Models page)
  useEffect(() => {
    fetchConfig();
  }, []);

<<<<<<< HEAD
  const hasChanges = currentConfig && selectedTokenCode !== currentConfig.tokenCode;

=======
>>>>>>> c5f5fe9 (refactor: separate model selection into dedicated Models page)
  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
<<<<<<< HEAD
            <h1 className="text-2xl font-bold text-app-text">Processing Model Configuration</h1>
            <p className="text-app-text-secondary mt-1">
              Select which AI model to use for receipt processing
=======
            <h1 className="text-2xl font-bold text-app-text">Recognition Models</h1>
            <p className="text-app-text-secondary mt-1">
              Configure which AI service to use for receipt processing
>>>>>>> c5f5fe9 (refactor: separate model selection into dedicated Models page)
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

<<<<<<< HEAD
        {/* Success State */}
        {successMessage && (
          <div className="mb-6 bg-green-900/50 border border-green-500 text-green-200 px-4 py-3 rounded-lg">
            {successMessage}
          </div>
        )}

        {/* Model Selection */}
        {!isLoading && (
          <div className="bg-app-surface border border-app-border rounded-lg p-6">
            <h2 className="text-lg font-semibold text-app-text mb-4">Available Models</h2>

            <div className="space-y-3">
              {AVAILABLE_MODELS.map((model) => (
                <label
                  key={model.tokenCode}
                  className={`
                    flex items-start p-4 rounded-lg border cursor-pointer transition-colors
                    ${selectedTokenCode === model.tokenCode
                      ? 'border-app-accent bg-app-accent/10'
                      : 'border-app-border hover:border-app-accent/50 hover:bg-app-surface-hover'
                    }
                  `}
                >
                  <input
                    type="radio"
                    name="model"
                    value={model.tokenCode}
                    checked={selectedTokenCode === model.tokenCode}
                    onChange={(e) => setSelectedTokenCode(e.target.value)}
                    className="mt-1 mr-3"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-app-text">{model.displayName}</div>
                    <div className="text-sm text-app-text-secondary mt-1">
                      {model.description}
                    </div>
                    <div className="text-xs text-app-text-muted mt-1">
                      Provider: {model.provider} • Model ID: {model.modelId}
                    </div>
                  </div>
                </label>
              ))}
            </div>

            {/* Save Button */}
            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={handleSave}
                disabled={!hasChanges || isSaving}
                className="px-6 py-2 bg-app-accent text-white rounded-lg
                         hover:bg-app-accent/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Saving...' : 'Save Configuration'}
              </button>
              {hasChanges && (
                <span className="text-sm text-app-text-secondary">
                  Unsaved changes
                </span>
              )}
            </div>
          </div>
        )}

        {/* Current Configuration */}
        {currentConfig && (
          <div className="mt-6 bg-app-surface border border-app-border rounded-lg p-6">
            <h2 className="text-lg font-semibold text-app-text mb-4">Current Configuration</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-app-text-secondary">Model:</span>
                <span className="text-app-text font-mono">{currentConfig.displayName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-app-text-secondary">Model ID:</span>
                <span className="text-app-text font-mono text-xs">{currentConfig.modelId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-app-text-secondary">Provider:</span>
                <span className="text-app-text font-mono">{currentConfig.provider}</span>
              </div>
              {currentConfig.updatedAt && (
                <div className="flex justify-between">
                  <span className="text-app-text-secondary">Last Updated:</span>
                  <span className="text-app-text">
                    {new Date(currentConfig.updatedAt).toLocaleString()}
                  </span>
                </div>
              )}
              {currentConfig.updatedBy && (
                <div className="flex justify-between">
                  <span className="text-app-text-secondary">Updated By:</span>
                  <span className="text-app-text font-mono text-xs">{currentConfig.updatedBy}</span>
                </div>
              )}
            </div>
          </div>
        )}
=======
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
>>>>>>> c5f5fe9 (refactor: separate model selection into dedicated Models page)
      </div>
    </Layout>
  );
}
