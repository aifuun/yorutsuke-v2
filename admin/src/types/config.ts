/**
 * System configuration types - Model selection and processing settings
 */

/**
 * System configuration interface with model selection support
 * BREAKING CHANGE: Batch processing removed, only instant mode supported
 * BREAKING CHANGE: Multi-model comparison removed, single model only
 */
export interface SystemConfig {
    // Processing mode (instant only, batch removed)
    processingMode: 'instant';

    // Primary model selection
    primaryModelId: string;

    // Azure DI configuration (optional, only if azure_di is selected as primaryModelId)
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
