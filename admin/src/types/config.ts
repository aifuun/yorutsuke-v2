/**
 * System configuration types - Model selection and processing settings
 */

/**
 * Comparison model type - selectable models for multi-model analysis
 */
export type ComparisonModel = 'textract' | 'nova_mini' | 'nova_pro' | 'azure_di';

/**
 * System configuration interface with model selection support
 * BREAKING CHANGE: Batch processing removed, only instant mode supported
 */
export interface SystemConfig {
    // Processing mode (instant only, batch removed)
    processingMode: 'instant';

    // Primary model selection
    primaryModelId: string;

    // Multi-model comparison configuration (future feature)
    enableComparison: boolean;
    comparisonModels: ComparisonModel[];

    // Azure DI configuration (optional)
    azureConfig?: {
        enabled: boolean;
        secretArn: string;
    } | null;

    // Metadata
    updatedAt: string;
    updatedBy: string;
}

/**
 * Backward compatibility alias
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
