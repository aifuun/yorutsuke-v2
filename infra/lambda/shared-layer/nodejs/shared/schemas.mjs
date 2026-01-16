import { z } from 'zod';

/**
 * AI OCR Result Schema (Pillar B: Airlock)
 * @ai-intent: Lenient on AI output - allow empty/invalid values, will be caught by TransactionSchema
 */
export const OcrResultSchema = z.object({
    amount: z.number().catch(0), // Default to 0 if invalid
    type: z.enum(['income', 'expense']).catch('expense'), // Default to expense
    date: z.string(), // Allow empty - will be validated/defaulted in TransactionSchema
    merchant: z.string(), // Allow empty - will be validated/defaulted in TransactionSchema
    category: z.enum(['food', 'transport', 'shopping', 'entertainment', 'utilities', 'health', 'other']).catch('other'),
    description: z.string().optional().default(''),
});

/**
 * Model Analysis Result Schema (unified format for all models)
 * Used for multi-model comparison (Textract, Nova Mini/Pro, Claude Sonnet)
 */
export const ModelResultSchema = z.object({
    vendor: z.string().optional(),
    lineItems: z.array(z.object({
        description: z.string(),
        quantity: z.number().optional(),
        unitPrice: z.number().optional(),
        totalPrice: z.number().optional(),
    })).optional(),
    subtotal: z.number().optional(),
    taxAmount: z.number().optional(),
    taxRate: z.number().optional(), // 8% or 10% for Japan
    totalAmount: z.number().optional(),
    confidence: z.number().optional(), // 0-100 confidence score
    rawResponse: z.record(z.any()).optional(), // @ai-intent: Store raw API response for debugging
});

/**
 * Multi-Model Comparison Schema
 * Stores results from all 4 models for A/B testing
 */
export const ModelComparisonSchema = z.object({
    textract: ModelResultSchema.optional(),
    nova_mini: ModelResultSchema.optional(),
    nova_pro: ModelResultSchema.optional(),
    azure_di: ModelResultSchema.optional(),
});

/**
 * DynamoDB Transaction Schema
 */
export const TransactionSchema = z.object({
    userId: z.string(),
    transactionId: z.string(),
    imageId: z.string().optional(),
    s3Key: z.string().optional(), // S3 object key for associated image
    amount: z.number(),
    type: z.enum(['income', 'expense']),
    date: z.string(),
    merchant: z.string(),
    merchantSource: z.enum(['list_match', 'ocr_fallback', 'unknown', 'user_edited']).optional(), // @ai-intent: Track merchant matching source for analytics
    category: z.string(),
    description: z.string(),
    status: z.enum(['unconfirmed', 'confirmed', 'deleted', 'needs_review']),
    aiProcessed: z.boolean().default(true),
    version: z.number().default(1),
    createdAt: z.string(),
    updatedAt: z.string(),
    confirmedAt: z.string().nullable().default(null),
    validationErrors: z.array(z.any()).optional(), // @ai-intent: Store Zod validation errors for debugging

    // Multi-model comparison (Pillar R: Observability for model evaluation)
    modelComparison: ModelComparisonSchema.optional(),
    comparisonStatus: z.enum(['pending', 'completed', 'failed']).optional(),
    comparisonTimestamp: z.string().optional(),
    comparisonErrors: z.array(z.object({
        model: z.string(),
        error: z.string(),
        timestamp: z.string().optional(),
    })).optional(),

    isGuest: z.boolean().optional(),
    ttl: z.number().optional(),
});
/**
 * Azure Document Intelligence Credentials Schema
 * @ai-intent: Separate schema for credentials validation, loaded from Secrets Manager at runtime
 */
export const AzureCredentialsSchema = z.object({
    endpoint: z.string().url().regex(/\.cognitiveservices\.azure\.com/, 'Must be valid Azure Cognitive Services endpoint'),
    apiKey: z.string().min(32, 'API key must be at least 32 characters'),
});

/**
 * Admin Batch Configuration Schema
 * @ai-intent: Extended to support dynamic model selection without redeployment
 */
export const BatchConfigSchema = z.object({
    processingMode: z.enum(['instant', 'batch', 'hybrid']),
    imageThreshold: z.number().min(100).max(500),
    timeoutMinutes: z.number().min(30).max(480),

    // Primary model selection (new)
    primaryModelId: z.string().default('us.amazon.nova-lite-v1:0'),

    // Multi-model comparison configuration (new)
    enableComparison: z.boolean().default(false),
    comparisonModels: z.array(z.enum(['textract', 'nova_mini', 'nova_pro', 'azure_di'])).default([]),

    // Azure DI configuration (new)
    azureConfig: z.object({
        enabled: z.boolean(),
        secretArn: z.string(),
    }).nullable().optional(),

    // Backward compatibility (deprecated - will be removed in 1 sprint)
    modelId: z.string().optional(),

    updatedAt: z.string(),
    updatedBy: z.string(),
});
