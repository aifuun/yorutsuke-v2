/**
 * Batch Orchestrator Lambda
 * 
 * Prepares manifest.jsonl and submits Bedrock Batch Inference job
 * 
 * Responsibilities:
 * 1. Read pending images from DynamoDB
 * 2. Generate manifest.jsonl (AWS Batch format)
 * 3. Upload manifest to S3
 * 4. Call Bedrock CreateModelInvocationJob
 * 5. Record job metadata in DynamoDB
 * 
 * Trigger: batch-counter Lambda (invoke)
 * Output: Batch Job ID → batch-result-handler
 */

import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient, QueryCommand, GetItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { BedrockClient, CreateModelInvocationJobCommand, GetModelInvocationJobCommand } from "@aws-sdk/client-bedrock";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { logger, EVENTS, initContext } from "/opt/nodejs/shared/logger.mjs";
import { z } from "zod";

const s3 = new S3Client({});
const ddb = new DynamoDBClient({});
const bedrock = new BedrockClient({ region: process.env.AWS_REGION || "us-west-2" });

const BUCKET_NAME = process.env.BUCKET_NAME;
const BATCH_JOBS_TABLE = process.env.BATCH_JOBS_TABLE || "yorutsuke-batch-jobs-us-dev";
const CONTROL_TABLE_NAME = process.env.CONTROL_TABLE_NAME;
const API_BASE_URL = process.env.API_BASE_URL || "https://api.example.com";

/**
 * Batch Job Submission Input Schema
 * Pillar Q: Idempotency - intentId required for retry semantics
 */
const BatchOrchestratorInputSchema = z.object({
    intentId: z.string().min(1, "intentId required for idempotency"),
    pendingImageIds: z.array(z.string()).min(100, "Must have at least 100 images"),
    modelId: z.string().default("us.amazon.nova-lite-v1:0"),
    userId: z.string(),
    batchJobThreshold: z.number().min(100).max(500).default(100),
});

/**
 * OCR prompt for Bedrock Batch processing
 */
const OCR_PROMPT = `あなたは日本語と英語に対応したレシート解析AIです。
この画像はレシートまたは領収書です。以下の情報を抽出してJSON形式で返してください。

必須フィールド:
- amount: 金額（数値、円単位）
- type: "income" または "expense"
- date: 日付（YYYY-MM-DD形式）
- merchant: 店舗名または取引先名
- category: カテゴリ（以下から選択）
  - sale: 売上
  - purchase: 仕入れ
  - shipping: 送料
  - packaging: 梱包材
  - fee: 手数料
  - other: その他
- description: 取引の説明（簡潔に）

JSON形式で返してください。マークダウンのコードブロックは使わないでください。`;

/**
 * Fetch pending images from S3 and generate manifest.jsonl
 * 
 * Each line is a JSON object for Bedrock Batch API:
 * {
 *   "modelId": "us.amazon.nova-lite-v1:0",
 *   "input": {
 *     "text": "prompt with base64 image"
 *   },
 *   "customData": "imageId"
 * }
 */
async function generateManifest(imageIds) {
    const manifestLines = [];
    let processedCount = 0;

    for (const imageId of imageIds) {
        try {
            // List objects matching imageId pattern: uploads/{userId}/{imageId}*
            // Assuming imageId is stored with a known pattern
            const listResponse = await s3.send(new ListObjectsV2Command({
                Bucket: BUCKET_NAME,
                Prefix: `uploads/`,
                MaxKeys: 1000,
            }));

            if (!listResponse.Contents) {
                logger.warn("No objects found in uploads/", { imageId });
                continue;
            }

            // Find matching image for this imageId
            const imageKey = listResponse.Contents.find(obj => obj.Key.includes(imageId));
            if (!imageKey) {
                logger.warn("Image not found in S3", { imageId });
                continue;
            }

            // Read image from S3
            const s3Response = await s3.send(new GetObjectCommand({
                Bucket: BUCKET_NAME,
                Key: imageKey.Key,
            }));

            const chunks = [];
            for await (const chunk of s3Response.Body) {
                chunks.push(chunk);
            }
            const imageBase64 = Buffer.concat(chunks).toString("base64");

            // Format for Bedrock Batch API (vision model)
            // Nova models support multimodal input with base64 images
            const input = {
                text: OCR_PROMPT,
                image: {
                    format: "jpeg",  // or "png" depending on stored format
                    source: {
                        bytes: imageBase64
                    }
                }
            };

            // Create manifest line (Bedrock Batch format)
            const manifestLine = JSON.stringify({
                modelId: "us.amazon.nova-lite-v1:0",
                input,
                customData: imageId,
            });

            manifestLines.push(manifestLine);
            processedCount++;

            // Limit to prevent timeout
            if (processedCount >= 1000) {
                logger.info("Manifest generation limit reached", { processedCount });
                break;
            }
        } catch (err) {
            logger.error("Failed to process image for manifest", { imageId, error: err.message });
        }
    }

    if (manifestLines.length === 0) {
        throw new Error("No valid images for manifest");
    }

    // Combine manifest lines into JSONL
    const manifestContent = manifestLines.join("\n") + "\n";

    // Upload manifest to S3
    const manifestKey = `batch-input/manifest-${Date.now()}.jsonl`;
    await s3.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: manifestKey,
        Body: manifestContent,
        ContentType: "text/x-jsonl",
    }));

    logger.info("Manifest uploaded to S3", { manifestKey, imageCount: manifestLines.length });

    return {
        s3Uri: `s3://${BUCKET_NAME}/${manifestKey}`,
        imageCount: manifestLines.length,
    };
}

/**
 * Submit Bedrock Batch Inference job
 */
async function submitBatchJob(manifestUri, modelId) {
    const jobName = `yorutsuke-batch-${Date.now()}`;

    logger.info("Submitting Bedrock Batch Job", { jobName, modelId });

    const response = await bedrock.send(new CreateModelInvocationJobCommand({
        jobName,
        modelId,  // e.g., "us.amazon.nova-lite-v1:0"
        inputDataConfig: {
            s3InputDataConfig: {
                s3Uri: manifestUri,
            },
        },
        outputDataConfig: {
            s3OutputDataConfig: {
                s3Uri: `s3://${BUCKET_NAME}/batch-output/`,
            },
        },
    }));

    return {
        jobId: response.jobId,
        status: response.status,
    };
}

/**
 * Check if this job has already been submitted (Pillar Q: Idempotency)
 * Uses intentId as the key to prevent duplicate submissions
 */
async function checkIdempotency(intentId) {
    try {
        const result = await ddb.send(new GetItemCommand({
            TableName: BATCH_JOBS_TABLE,
            Key: marshall({ intentId }),
        }));

        if (result.Item) {
            const item = unmarshall(result.Item);
            if (item.status === "PROCESSING") {
                // Still processing - return cached response
                logger.info("Job still processing (idempotency cache)", { intentId, jobId: item.jobId });
                return { cached: true, jobId: item.jobId, status: item.status };
            } else if (item.status === "SUBMITTED" || item.status === "COMPLETED") {
                // Already completed - return cached result
                logger.info("Job already submitted (idempotency cache hit)", { intentId, jobId: item.jobId });
                return { cached: true, jobId: item.jobId, status: item.status };
            }
        }
        return { cached: false };
    } catch (error) {
        logger.warn("Idempotency check failed", { intentId, error: error.message });
        // Continue - don't block on cache miss
        return { cached: false };
    }
}

/**
 * Record batch job metadata in DynamoDB with idempotency marker
 * Pillar Q: Uses intentId as partition key to prevent duplicate submissions
 * Pillar F: Conditional write to ensure atomic operation
 */
async function recordJobMetadata(jobId, userId, imageCount, modelId, manifestUri, intentId) {
    const timestamp = new Date().toISOString();
    const jobData = {
        intentId,           // Pillar Q: Use intentId as partition key
        jobId,              // GSI for reverse lookup
        userId,
        status: "SUBMITTED",
        submitTime: timestamp,
        pendingImageCount: imageCount,
        modelId,
        manifestUri,
        ttl: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
    };

    // Conditional write: only write if intentId doesn't exist (prevent duplicates)
    try {
        await ddb.send(new PutItemCommand({
            TableName: BATCH_JOBS_TABLE,
            Item: marshall(jobData),
            ConditionExpression: "attribute_not_exists(intentId)",  // Pillar F: Concurrency control
        }));
        logger.info("Batch job metadata recorded", { intentId, jobId, imageCount });
    } catch (error) {
        if (error.name === "ConditionalCheckFailedException") {
            // Another request already recorded this intentId - safe to return cached
            logger.info("Job already recorded (concurrent duplicate prevented)", { intentId });
            return { duplicate: true };
        }
        throw error;
    }
}

/**
 * Handler: Main orchestration logic
 * Pillar B: Robust input parsing with airlock (parse event.body first)
 * Pillar Q: Idempotency wrapper with intentId check
 */
export async function handler(event) {
    const ctx = initContext(event);

    try {
        // 1. Robust input parsing (Pillar B: Airlock)
        // Prefer event.body (API Gateway), fallback to direct event (direct invoke)
        const payload = typeof event.body === 'string' 
            ? JSON.parse(event.body) 
            : (event.body || event);
        
        logger.info(EVENTS.BATCH_STARTED, { event: Object.keys(event) });

        const input = BatchOrchestratorInputSchema.parse(payload);
        const { intentId, pendingImageIds, modelId, userId, batchJobThreshold } = input;

        // 2. Check idempotency (Pillar Q)
        const idempotencyResult = await checkIdempotency(intentId);
        if (idempotencyResult.cached) {
            const statusUrl = `${API_BASE_URL}/api/batch/jobs/${idempotencyResult.jobId}`;
            logger.info("Returning cached result", { intentId, jobId: idempotencyResult.jobId });
            return {
                statusCode: 202,
                body: JSON.stringify({
                    jobId: idempotencyResult.jobId,
                    status: idempotencyResult.status,
                    statusUrl,
                    message: `Batch Job ${idempotencyResult.jobId} (from cache)`,
                    cached: true,
                }),
            };
        }

        // 3. Mark as processing (Pillar Q: idempotency barrier)
        await ddb.send(new PutItemCommand({
            TableName: BATCH_JOBS_TABLE,
            Item: marshall({
                intentId,
                jobId: `job_processing_${Date.now()}`,
                status: "PROCESSING",
                startTime: new Date().toISOString(),
                ttl: Math.floor(Date.now() / 1000) + 3600,  // 1 hour processing TTL
            }),
            ConditionExpression: "attribute_not_exists(intentId)",
        }));

        // 4. Generate manifest.jsonl
        const { s3Uri: manifestUri, imageCount } = await generateManifest(pendingImageIds);

        // 5. Submit Bedrock Batch Job
        const { jobId, status } = await submitBatchJob(manifestUri, modelId);

        // 6. Record job metadata (Pillar Q: with intentId and conditional write)
        await recordJobMetadata(jobId, userId, imageCount, modelId, manifestUri, intentId);

        // 7. Return success response with statusUrl (Pillar O: Async pattern)
        const statusUrl = `${API_BASE_URL}/api/batch/jobs/${jobId}`;
        const response = {
            jobId,
            status,
            imageCount,
            estimatedCost: imageCount * 0.000375,  // ¥0.375 / 1000 images for Nova Lite Batch
            statusUrl,  // Pillar O: polling endpoint
            estimatedDuration: Math.ceil(imageCount / 10),  // ~10 images/sec
            message: `Batch Job ${jobId} submitted successfully`,
        };

        logger.info(EVENTS.BATCH_COMPLETED, response);

        return {
            statusCode: 202,
            body: JSON.stringify(response),
        };
    } catch (error) {
        logger.error(EVENTS.BATCH_FAILED, { error: error.message, stack: error.stack });

        // Validation error
        if (error instanceof z.ZodError) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: "Invalid input",
                    errors: error.errors,
                }),
            };
        }

        // Concurrent duplicate error (another request won the race)
        if (error.name === "ConditionalCheckFailedException") {
            return {
                statusCode: 409,
                body: JSON.stringify({
                    message: "Duplicate submission detected - use intentId to retry",
                    retryable: true,
                }),
            };
        }

        // AWS API error
        if (error.name === "ValidationException" || error.name === "ThrottlingException") {
            return {
                statusCode: 429,
                body: JSON.stringify({
                    message: `AWS API error: ${error.message}`,
                }),
            };
        }

        return {
            statusCode: 500,
            body: JSON.stringify({
                message: "Batch orchestration failed",
                error: error.message,
            }),
        };
    }
}
