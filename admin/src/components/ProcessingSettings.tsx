import { useState } from 'react';
import type { BatchConfig, ComparisonModel } from '../types/batch';
import { AVAILABLE_MODELS, AVAILABLE_PRIMARY_MODELS, AVAILABLE_COMPARISON_MODELS } from '../types/batch';
import { api, endpoints } from '../api/client';

interface ProcessingSettingsProps {
    config: BatchConfig;
    onSave: (newConfig: BatchConfig) => void;
}

export function ProcessingSettings({ config, onSave }: ProcessingSettingsProps) {
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
            const updated = await api.post<BatchConfig>(endpoints.batchConfig, localConfig);
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

    const toggleComparisonModel = (modelId: ComparisonModel) => {
        setLocalConfig(prev => ({
            ...prev,
            comparisonModels: prev.comparisonModels.includes(modelId)
                ? prev.comparisonModels.filter(m => m !== modelId)
                : [...prev.comparisonModels, modelId]
        }));
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
        <div className="bg-app-surface border border-app-border rounded-lg p-6 mb-8">
            <h2 className="text-lg font-semibold text-app-text mb-4">
                Processing Settings
            </h2>

            {/* Processing Mode */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-app-text-secondary mb-3">
                    Processing Mode
                </label>
                <div className="space-y-3">
                    <ModeOption
                        value="instant"
                        selected={localConfig.processingMode === 'instant'}
                        label="Instant (On-Demand)"
                        description="Process each receipt immediately after upload"
                        recommended
                        onClick={() => updateField('processingMode', 'instant')}
                    />
                    <ModeOption
                        value="batch"
                        selected={localConfig.processingMode === 'batch'}
                        label="Batch Only (50% Discount)"
                        description="Accumulate images and process after reaching threshold"
                        onClick={() => updateField('processingMode', 'batch')}
                    />
                    <ModeOption
                        value="hybrid"
                        selected={localConfig.processingMode === 'hybrid'}
                        label="Hybrid"
                        description="Use Batch if threshold met, fallback to Instant on timeout"
                        onClick={() => updateField('processingMode', 'hybrid')}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Conditional: Threshold */}
                {(localConfig.processingMode === 'batch' || localConfig.processingMode === 'hybrid') && (
                    <div>
                        <label className="block text-sm font-medium text-app-text-secondary mb-2">
                            Image Threshold
                        </label>
                        <input
                            type="number"
                            min={100}
                            max={500}
                            value={localConfig.imageThreshold}
                            onChange={(e) => updateField('imageThreshold', parseInt(e.target.value))}
                            className="w-full bg-app-bg border border-app-border rounded-lg px-4 py-2 text-app-text focus:outline-none focus:border-app-accent"
                        />
                        <p className="text-xs text-app-text-secondary mt-1">Minimum 100 for AWS Bedrock Batch</p>
                    </div>
                )}

                {/* Conditional: Timeout */}
                {localConfig.processingMode === 'hybrid' && (
                    <div>
                        <label className="block text-sm font-medium text-app-text-secondary mb-2">
                            Timeout (minutes)
                        </label>
                        <input
                            type="number"
                            min={30}
                            max={480}
                            value={localConfig.timeoutMinutes}
                            onChange={(e) => updateField('timeoutMinutes', parseInt(e.target.value))}
                            className="w-full bg-app-bg border border-app-border rounded-lg px-4 py-2 text-app-text focus:outline-none focus:border-app-accent"
                        />
                    </div>
                )}
            </div>

            {/* Primary Model Selection */}
            <div className="mb-8 pb-8 border-b border-app-border">
                <label className="block text-sm font-medium text-app-text-secondary mb-3">
                    Primary OCR Model
                </label>
                <p className="text-xs text-app-text-secondary mb-4">
                    Select which model to use for main receipt processing
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

            {/* Multi-Model Comparison */}
            <div className="mb-8 pb-8 border-b border-app-border">
                <label className="flex items-center gap-3 mb-4">
                    <input
                        type="checkbox"
                        checked={localConfig.enableComparison}
                        onChange={(e) => updateField('enableComparison', e.target.checked)}
                        className="w-4 h-4 rounded cursor-pointer"
                    />
                    <span className="text-sm font-medium text-app-text">
                        Enable Multi-Model Comparison
                    </span>
                </label>

                {localConfig.enableComparison && (
                    <div className="ml-7 space-y-2">
                        <p className="text-xs text-app-text-secondary mb-3">
                            Select additional models to compare against primary model
                        </p>
                        {AVAILABLE_COMPARISON_MODELS.map((model) => (
                            <label
                                key={model.id}
                                className="flex items-center gap-3 p-3 rounded-lg border border-app-border hover:border-app-text-secondary/50 cursor-pointer transition-all"
                            >
                                <input
                                    type="checkbox"
                                    checked={localConfig.comparisonModels.includes(model.id)}
                                    onChange={() => toggleComparisonModel(model.id)}
                                    className="w-4 h-4 rounded cursor-pointer"
                                />
                                <div className="flex-1">
                                    <div className="text-sm font-medium text-app-text">{model.name}</div>
                                    <div className="text-xs text-app-text-secondary">{model.description}</div>
                                </div>
                            </label>
                        ))}
                    </div>
                )}
            </div>

            {/* Azure DI Credentials (Conditional) */}
            {localConfig.enableComparison && localConfig.comparisonModels.includes('azure_di') && (
                <div className="mb-8 pb-8 border-b border-app-border p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <h3 className="text-sm font-semibold text-amber-100 mb-4">
                        Azure Document Intelligence Credentials
                    </h3>
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
                {success && <span className="text-green-400 text-sm font-medium">✓ Config saved!</span>}
                {error && <span className="text-red-400 text-sm font-medium">{error}</span>}
            </div>
        </div>
    );
}

interface ModeOptionProps {
    value: string;
    selected: boolean;
    label: string;
    description: string;
    recommended?: boolean;
    onClick: () => void;
}

function ModeOption({ selected, label, description, recommended, onClick }: ModeOptionProps) {
    return (
        <div
            onClick={onClick}
            className={`p-4 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${selected
                ? 'border-app-accent bg-app-accent/10'
                : 'border-app-border hover:border-app-text-secondary/50'
                }`}
        >
            <div>
                <div className="font-medium text-app-text flex items-center gap-2">
                    {label}
                    {recommended && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded uppercase font-bold">
                            Recommended
                        </span>
                    )}
                </div>
                <div className="text-sm text-app-text-secondary">{description}</div>
            </div>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selected ? 'border-app-accent' : 'border-app-text-secondary'
                }`}>
                {selected && <div className="w-2.5 h-2.5 rounded-full bg-app-accent" />}
            </div>
        </div>
    );
}
