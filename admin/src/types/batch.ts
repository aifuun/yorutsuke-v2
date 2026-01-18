/**
 * Comparison model type - selectable models for multi-model analysis
 */
export type ComparisonModel = 'textract' | 'nova_mini' | 'nova_pro' | 'azure_di';

/**
 * System configuration interface with model selection support
 */
export interface SystemConfig {
    processingMode: 'instant' | 'batch' | 'hybrid';
    imageThreshold: number;
    timeoutMinutes: number;

    // Primary model selection (new)
    primaryModelId: string;

    // Multi-model comparison configuration (new)
    enableComparison: boolean;
    comparisonModels: ComparisonModel[];

    // Azure DI configuration (new)
    azureConfig?: {
        enabled: boolean;
        secretArn: string;
    } | null;

    // Backward compatibility
    modelId?: string;

    updatedAt: string;
    updatedBy: string;
}

/**
 * Backward compatibility alias (deprecated - will be removed in next version)
 */
export type BatchConfig = SystemConfig;

/**
 * Primary models for main OCR processing
 */
export const AVAILABLE_PRIMARY_MODELS = [
    {
        id: 'us.amazon.nova-lite-v1:0',
        name: 'Nova Lite',
        description: 'Recommended, low cost (~¥0.015/image)'
    },
    {
        id: 'amazon.nova-pro-v1:0',
        name: 'Nova Pro',
        description: 'Higher accuracy (~¥0.06/image)'
    },
    {
        id: 'azure_di',
        name: 'Azure Document Intelligence',
        description: 'Requires credential setup'
    },
] as const;

/**
 * Comparison models for multi-model analysis
 */
export const AVAILABLE_COMPARISON_MODELS = [
    {
        id: 'textract' as const,
        name: 'AWS Textract',
        description: 'AnalyzeExpense API'
    },
    {
        id: 'nova_mini' as const,
        name: 'Nova Mini',
        description: 'Fast, low cost'
    },
    {
        id: 'nova_pro' as const,
        name: 'Nova Pro',
        description: 'High accuracy'
    },
    {
        id: 'azure_di' as const,
        name: 'Azure Document Intelligence',
        description: 'Requires credential setup'
    },
] as const;

/**
 * Legacy models (deprecated but kept for backward compatibility)
 */
export const AVAILABLE_MODELS = [
    {
        id: 'amazon.nova-lite-v1:0',
        name: 'Nova Lite',
        description: 'Recommended, low cost'
    },
    {
        id: 'amazon.nova-pro-v1:0',
        name: 'Nova Pro',
        description: 'Higher accuracy'
    },
    {
        id: 'anthropic.claude-3-haiku-20240307-v1:0',
        name: 'Claude 3 Haiku',
        description: 'Alternative'
    },
] as const;
