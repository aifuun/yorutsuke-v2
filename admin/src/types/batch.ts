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
        id: 'azure-di',
        name: 'Azure DI',
        description: 'Document Intelligence service'
    },
] as const;
