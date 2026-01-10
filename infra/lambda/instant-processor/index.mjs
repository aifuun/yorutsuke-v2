import { S3Client, GetObjectCommand, CopyObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient, PutItemCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { logger, EVENTS, initContext } from "/opt/nodejs/shared/logger.mjs";
import { OcrResultSchema, TransactionSchema } from "/opt/nodejs/shared/schemas.mjs";

const s3 = new S3Client({});
const ddb = new DynamoDBClient({});
const bedrock = new BedrockRuntimeClient({});

const BUCKET_NAME = process.env.BUCKET_NAME;
const TRANSACTIONS_TABLE_NAME = process.env.TRANSACTIONS_TABLE_NAME;
const CONTROL_TABLE_NAME = process.env.CONTROL_TABLE_NAME;

// Guest data expires after 60 days
const GUEST_TTL_DAYS = 60;

function isGuestUser(userId) {
    return userId.startsWith("device-") || userId.startsWith("ephemeral-");
}

function getGuestTTL() {
    return Math.floor(Date.now() / 1000) + GUEST_TTL_DAYS * 24 * 60 * 60;
}

/**
 * OCR prompt for receipt analysis - Nova Lite optimized
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

JSON形式で返してください。マークダウンのコードブロックは使わないでください。
例: {"amount": 1500, "type": "expense", "date": "2025-01-15", "merchant": "ヤマト運輸", "category": "shipping", "description": "荷物発送"}`;

export async function handler(event) {
    const ctx = initContext(event);
    logger.info(EVENTS.IMAGE_PROCESSING_STARTED, { recordCount: event.Records.length });

    for (const record of event.Records) {
        const bucket = record.s3.bucket.name;
        const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

        // 1. Extract metadata from key: uploads/{userId}/{timestamp}-{filename}
        const keyParts = key.split('/');
        if (keyParts.length < 3) {
            logger.warn(EVENTS.IMAGE_PROCESSING_FAILED, { key, reason: "INVALID_KEY_STRUCTURE" });
            continue;
        }

        const userId = keyParts[1];
        const fileName = keyParts[2];
        // imageId is {timestamp}-{filename} without extension
        const imageId = fileName.replace(/\.[^/.]+$/, "");

        try {
            // 2. Pillar Q: Idempotency check - stable transactionId
            // Use imageId as the stable transactionId to prevent duplicates on retries
            const transactionId = `tx-${imageId}`;

            // 3. Get image from S3
            const s3Response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
            const chunks = [];
            for await (const chunk of s3Response.Body) {
                chunks.push(chunk);
            }
            const imageBase64 = Buffer.concat(chunks).toString("base64");

            // 4. Call Bedrock
            // Fetch configuration for modelId
            let modelId = "amazon.nova-lite-v1:0";
            try {
                const configResult = await ddb.send(new GetItemCommand({
                    TableName: CONTROL_TABLE_NAME,
                    Key: marshall({ key: 'batch_config' }),
                }));
                if (configResult.Item) {
                    const config = unmarshall(configResult.Item);
                    if (config.modelId) {
                        modelId = config.modelId;
                    }
                }
            } catch (err) {
                logger.warn("Failed to fetch modelId from ControlTable, using default", { error: err.message });
            }

            const payload = {
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                image: {
                                    format: "webp",
                                    source: { bytes: imageBase64 },
                                },
                            },
                            { text: OCR_PROMPT },
                        ],
                    },
                ],
                inferenceConfig: {
                    maxTokens: 1024,
                    temperature: 0.1,
                },
            };

            const bedrockResponse = await bedrock.send(
                new InvokeModelCommand({
                    modelId: modelId,
                    contentType: "application/json",
                    accept: "application/json",
                    body: JSON.stringify(payload),
                })
            );

            const responseBody = JSON.parse(new TextDecoder().decode(bedrockResponse.body));
            const ocrText = responseBody.output?.message?.content?.[0]?.text || "";

            // 5. Pillar B: Airlock - Parse & Validate AI output
            let jsonStr = ocrText.trim();
            if (jsonStr.startsWith("```")) {
                jsonStr = jsonStr.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
            }

            let parsed;
            try {
                parsed = OcrResultSchema.parse(JSON.parse(jsonStr));
            } catch (zodError) {
                logger.error(EVENTS.AIRLOCK_BREACH, { userId, imageId, error: zodError.message, raw: jsonStr });
                continue; // Skip this record on airlock breach
            }

            // 6. Pillar B: Validate complete transaction object
            const now = new Date().toISOString();
            // Use final processed/ path, not uploads/ (image will be moved to processed/)
            const processedKey = key.replace("uploads/", "processed/");
            const transactionData = {
                userId,
                transactionId,
                imageId,
                s3Key: processedKey, // Store S3 key for image sync optimization
                amount: parsed.amount,
                type: parsed.type,
                date: parsed.date,
                merchant: parsed.merchant,
                category: parsed.category,
                description: parsed.description,
                status: 'unconfirmed',
                aiProcessed: true,
                version: 1,
                createdAt: now,
                updatedAt: now,
                confirmedAt: null,
            };

            if (isGuestUser(userId)) {
                transactionData.ttl = getGuestTTL();
                transactionData.isGuest = true;
            }

            // Use safeParse to handle validation failures gracefully
            const validationResult = TransactionSchema.safeParse(transactionData);
            let transaction;

            if (!validationResult.success) {
                // @ai-intent: Create transaction with needs_review status for manual correction
                logger.warn(EVENTS.AIRLOCK_BREACH, {
                    userId,
                    imageId,
                    error: JSON.stringify(validationResult.error.issues),
                    raw: JSON.stringify(transactionData)
                });

                // Create fallback transaction with needs_review status
                transaction = {
                    userId,
                    transactionId,
                    imageId,
                    s3Key: processedKey, // Store S3 key for image sync optimization
                    amount: parsed.amount || 0,
                    type: parsed.type || 'expense',
                    date: parsed.date || new Date().toISOString().split('T')[0], // Use today if empty
                    merchant: parsed.merchant || 'Unknown',
                    category: parsed.category || 'other',
                    description: parsed.description || 'Validation failed - needs review',
                    status: 'needs_review', // Mark for manual review
                    aiProcessed: true,
                    version: 1,
                    createdAt: now,
                    updatedAt: now,
                    confirmedAt: null,
                    validationErrors: validationResult.error.issues, // Store errors for debugging
                    ...(isGuestUser(userId) && { ttl: getGuestTTL(), isGuest: true }),
                };
            } else {
                transaction = validationResult.data;
            }

            // 7. Write to DynamoDB (Pillar Q: Conditional check for idempotency)
            try {
                await ddb.send(new PutItemCommand({
                    TableName: TRANSACTIONS_TABLE_NAME,
                    Item: marshall(transaction),
                    ConditionExpression: "attribute_not_exists(transactionId)",
                }));
            } catch (ddbError) {
                if (ddbError.name === "ConditionalCheckFailedException") {
                    logger.info(EVENTS.IMAGE_PROCESSING_CACHED, { transactionId });
                    // If transaction already exists, we still want to proceed to mark image as processed
                } else {
                    throw ddbError;
                }
            }

            // 8. Move to processed/ (reuse processedKey from above)
            await s3.send(new CopyObjectCommand({
                Bucket: bucket,
                CopySource: `${bucket}/${key}`,
                Key: processedKey,
            }));
            await s3.send(new DeleteObjectCommand({
                Bucket: bucket,
                Key: key,
            }));

            logger.info(EVENTS.IMAGE_PROCESSING_COMPLETED, { userId, imageId, transactionId });

        } catch (error) {
            logger.error(EVENTS.IMAGE_PROCESSING_FAILED, { userId, key, error: error.message });
            // We don't throw to avoid S3 retry loops for data errors
        }
    }
}

// Force deploy: 2026-01-09-17:36 (lenient OCR schema)
