import { useState } from 'react';
import type { BatchConfig } from '../types/batch';
import { AVAILABLE_PRIMARY_MODELS } from '../types/batch';
import { api, endpoints } from '../api/client';

interface ModelSelectionProps {
    config: BatchConfig;
    onSave: (newConfig: BatchConfig) => void;
}

export function ModelSelection({ config, onSave }: ModelSelectionProps) {
    const [localConfig, setLocalConfig] = useState<BatchConfig>(config);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [azureEndpoint, setAzureEndpoint] = useState('');
    const [azureApiKey, setAzureApiKey] = useState('');
    const [azureCredSaving, setAzureCredSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        setError(null);
        setSuccess(false);
        try {
            const updated = await api.post<BatchConfig>(endpoints.modelConfig, localConfig);
            onSave(updated);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to save configuration');
        } finally {
            setIsSaving(false);
        }
    };

    const updateField = (field: keyof BatchConfig, value: any) => {
        setLocalConfig(prev => ({ ...prev, [field]: value }));
    };

    const handleSaveAzureCredentials = async () => {
        setAzureCredSaving(true);
        setError(null);
        try {
            await api.post(endpoints.azureCredentials, {
                endpoint: azureEndpoint,
                apiKey: azureApiKey,
            });
            setSuccess(true);
            setAzureEndpoint('');
            setAzureApiKey('');
            setTimeout(() => setSuccess(false), 3000);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to save Azure credentials');
        } finally {
            setAzureCredSaving(false);
        }
    };

    return (
        <div className="bg-app-surface border border-app-border rounded-lg p-6">
            <h2 className="text-lg font-semibold text-app-text mb-4">
                Recognition Service Selection
            </h2>
            <p className="text-sm text-app-text-secondary mb-6">
                Choose which AI service to use for receipt processing. Each service has different accuracy and cost characteristics.
            </p>

            {/* Model Selection */}
            <div className="mb-8">
                <label className="block text-sm font-medium text-app-text-secondary mb-3">
                    Available Services
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {AVAILABLE_PRIMARY_MODELS.map((model) => (
                        <div
                            key={model.id}
                            onClick={() => updateField('primaryModelId', model.id)}
                            className={`p-4 rounded-lg border cursor-pointer transition-all ${localConfig.primaryModelId === model.id
                                ? 'border-app-accent bg-app-accent/10'
                                : 'border-app-border hover:border-app-text-secondary/50'
                                }`}
                        >
                            <div className="font-medium text-app-text">{model.name}</div>
                            <div className="text-xs text-app-text-secondary mt-1">{model.description}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Azure DI Credentials (Conditional) */}
            {localConfig.primaryModelId === 'azure_di' && (
                <div className="mb-8 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <h3 className="text-sm font-semibold text-amber-100 mb-4">
                        Azure Document Intelligence Credentials
                    </h3>
                    <p className="text-xs text-app-text-secondary mb-4">
                        Enter your Azure DI endpoint and API key. These credentials are stored securely in AWS Secrets Manager.
                    </p>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-medium text-app-text-secondary mb-1">
                                Azure Endpoint URL
                            </label>
                            <input
                                type="text"
                                placeholder="https://your-resource.cognitiveservices.azure.com/"
                                value={azureEndpoint}
                                onChange={(e) => setAzureEndpoint(e.target.value)}
                                className="w-full bg-app-bg border border-app-border rounded-lg px-3 py-2 text-xs text-app-text focus:outline-none focus:border-app-accent"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-app-text-secondary mb-1">
                                API Key
                            </label>
                            <input
                                type="password"
                                placeholder="Your Azure DI API key (kept secure)"
                                value={azureApiKey}
                                onChange={(e) => setAzureApiKey(e.target.value)}
                                className="w-full bg-app-bg border border-app-border rounded-lg px-3 py-2 text-xs text-app-text focus:outline-none focus:border-app-accent"
                            />
                        </div>
                        <button
                            onClick={handleSaveAzureCredentials}
                            disabled={azureCredSaving || !azureEndpoint || !azureApiKey}
                            className="w-full px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium text-xs disabled:opacity-50"
                        >
                            {azureCredSaving ? 'Updating...' : 'Update Azure Credentials'}
                        </button>
                    </div>
                </div>
            )}

            {/* Action Area */}
            <div className="flex items-center gap-4">
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-6 py-2 bg-app-accent text-white rounded-lg hover:bg-app-accent/80 transition-colors font-medium disabled:opacity-50"
                >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
                {success && <span className="text-green-400 text-sm font-medium">✓ Configuration saved!</span>}
                {error && <span className="text-red-400 text-sm font-medium">{error}</span>}
            </div>
        </div>
    );
}
