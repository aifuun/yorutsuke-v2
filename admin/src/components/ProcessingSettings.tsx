import { useState } from 'react';
import type { BatchConfig } from '../types/batch';
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

    return (
        <div className="bg-app-surface border border-app-border rounded-lg p-6 mb-8">
            <h2 className="text-lg font-semibold text-app-text mb-4">
                Processing Mode
            </h2>
            <p className="text-sm text-app-text-secondary mb-6">
                Configure how receipts are processed. Recognition service can be changed in the Models page.
            </p>

            {/* Processing Mode */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-app-text-secondary mb-3">
                    Select Processing Mode
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
