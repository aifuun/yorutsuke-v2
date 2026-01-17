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

/**
 * Model Configuration Interface (Issue #149)
 */
export interface ModelConfig {
    modelId: string;
    tokenCode: string;
    provider: 'aws-bedrock' | 'azure-openai';
    displayName: string;
    description: string;
    config?: Record<string, any>;
    updatedAt?: string;
    updatedBy?: string;
}

export const AVAILABLE_MODELS: ModelConfig[] = [
    {
        modelId: 'us.amazon.nova-lite-v1:0',
        tokenCode: 'nova-lite',
        provider: 'aws-bedrock',
        displayName: 'Nova Lite',
        description: 'Recommended, low cost'
    },
    {
        modelId: 'us.amazon.nova-pro-v1:0',
        tokenCode: 'nova-pro',
        provider: 'aws-bedrock',
        displayName: 'Nova Pro',
        description: 'Higher accuracy'
    },
    {
        modelId: 'azure-document-intelligence',
        tokenCode: 'azure-di',
        provider: 'azure-openai',
        displayName: 'Azure DI',
        description: 'External provider (Document Intelligence)'
    },
];
