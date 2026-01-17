export interface BatchConfig {
    processingMode: 'instant' | 'batch' | 'hybrid';
    imageThreshold: number;
    timeoutMinutes: number;
    modelId: string;
    azureEndpoint?: string;
    azureApiKey?: string;
    updatedAt: string;
    updatedBy: string;
}

export const AVAILABLE_MODELS = [
    {
        id: 'us.amazon.nova-lite-v1:0',
        name: 'Nova Lite',
        description: 'Recommended, low cost'
    },
    {
        id: 'us.amazon.nova-pro-v1:0',
        name: 'Nova Pro',
        description: 'Higher accuracy'
    },
    {
        id: 'us.anthropic.claude-3-haiku-20240307-v1:0',
        name: 'Claude 3 Haiku',
        description: 'Alternative'
    },
] as const;
