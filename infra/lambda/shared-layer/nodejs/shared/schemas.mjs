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

    // AI Processing Metadata (simplified)
    processingModel: z.string().optional(), // Model ID configured in Admin Panel (e.g., 'us.amazon.nova-lite-v1:0')
    confidence: z.number().min(0).max(1).optional(), // AI confidence score (0.0-1.0)

    isGuest: z.boolean().optional(),
    ttl: z.number().optional(),
});
/**
 * Admin Batch Configuration Schema
 */
export const BatchConfigSchema = z.object({
    processingMode: z.enum(['instant', 'batch', 'hybrid']),
    imageThreshold: z.number().min(100).max(500),
    timeoutMinutes: z.number().min(30).max(480),
    modelId: z.string().default('us.amazon.nova-lite-v1:0'),  // Must include region prefix
    updatedAt: z.string(),
    updatedBy: z.string(),
});

/**
 * Model Configuration Schema (Issue #149)
 * Dynamic model selection for receipt processing
 */
export const ModelConfigSchema = z.object({
    modelId: z.string(), // Full model ID (e.g., "us.amazon.nova-lite-v1:0")
    tokenCode: z.string(), // Short code for UI (e.g., "nova-lite")
    provider: z.enum(['aws-bedrock', 'azure-openai']), // AI provider
    displayName: z.string(), // Human-readable name (e.g., "Nova Lite")
    description: z.string(), // Description for UI (e.g., "Low cost, recommended")
    config: z.record(z.any()).optional(), // Provider-specific config (e.g., Azure endpoint)
    updatedAt: z.string(), // ISO timestamp
    updatedBy: z.string(), // Cognito sub
});
