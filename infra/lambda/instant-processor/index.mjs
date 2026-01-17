import { S3Client, GetObjectCommand, CopyObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { marshall } from "@aws-sdk/util-dynamodb";
import { logger, EVENTS, initContext } from "/opt/nodejs/shared/logger.mjs";
import { OcrResultSchema, TransactionSchema } from "/opt/nodejs/shared/schemas.mjs";

const s3 = new S3Client({});
const ddb = new DynamoDBClient({});
const bedrock = new BedrockRuntimeClient({});

const BUCKET_NAME = process.env.BUCKET_NAME;
const TRANSACTIONS_TABLE_NAME = process.env.TRANSACTIONS_TABLE_NAME;
const MODEL_ID = process.env.MODEL_ID || "us.amazon.nova-lite-v1:0";

// Guest data expires after 60 days
const GUEST_TTL_DAYS = 60;

// Cached merchant list (persists across invocations in same Lambda container)
let cachedMerchantList = null;

/**
 * Load merchant list from S3 (cached in memory after first load)
 */
async function loadMerchantList() {
  if (cachedMerchantList) {
    logger.debug('MERCHANT_LIST_CACHE_HIT', { count: cachedMerchantList.length });
    return cachedMerchantList;
  }

  try {
    const response = await s3.send(new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: 'merchants/common-merchants.json',
    }));

    const body = await response.Body.transformToString();
    const data = JSON.parse(body);

    cachedMerchantList = data.merchants.map(m => m.name);
    logger.info('MERCHANT_LIST_LOADED', { count: cachedMerchantList.length });

    return cachedMerchantList;
  } catch (error) {
    logger.warn('MERCHANT_LIST_LOAD_FAILED', { error: String(error) });
    return [];
  }
}

function isGuestUser(userId) {
    return userId.startsWith("device-") || userId.startsWith("ephemeral-");
}

function getGuestTTL() {
    return Math.floor(Date.now() / 1000) + GUEST_TTL_DAYS * 24 * 60 * 60;
}

/**
 * Build OCR prompt with optional merchant list
 */
function buildOCRPrompt(merchantList) {
  const merchantListText = merchantList.length > 0
    ? `\n\n**既知の店舗リスト** (レシート上の店舗名をこのリストと照合してください):\n${merchantList.join(', ')}\n\nレシート上の店舗名がこのリストのいずれかと完全または部分的に一致する場合（例："7-11" → "セブン-イレブン (7-Eleven)", "ローソン" → "ローソン (Lawson)"), リストから標準化された店舗名を使用してください。一致しない場合は、merchant を "Unknown" に設定してください。`
    : '';

  return `あなたは日本語と英語に対応したレシート解析AIです。
この画像はレシートまたは領収書です。以下の情報を抽出してJSON形式で返してください。

必須フィールド:
- amount: 金額（数値、円単位）
- type: "income" または "expense"
- date: 日付（YYYY-MM-DD形式）
- merchant: 店舗名または取引先名
- category: カテゴリ（以下から選択）
  - food: 餐饮（飲食）
  - transport: 交通（交通費）
  - shopping: 购物（買い物）
  - entertainment: 娱乐（娯楽）
  - utilities: 水电费（水道光熱費）
  - health: 医疗（医療）
  - other: その他
- description: 取引の説明（簡潔に）${merchantListText}

JSON形式で返してください。マークダウンのコードブロックは使わないでください。
例: {"amount": 1500, "type": "expense", "date": "2025-01-15", "merchant": "ファミリーマート (FamilyMart)", "category": "food", "description": "昼食"}`;
}

export async function handler(event) {
    const ctx = initContext(event);
    logger.info(EVENTS.IMAGE_PROCESSING_STARTED, { recordCount: event.Records.length });

    // Load merchant list once at start (cached for subsequent invocations)
    const merchantList = await loadMerchantList();
    const ocrPrompt = buildOCRPrompt(merchantList);

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
        // fileName format: {timestamp}-{uuid}.webp
        // Extract just the UUID part (after the timestamp prefix)
        const fileNameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
        // Remove timestamp prefix (13 digits + hyphen) to get just the UUID
        const imageId = fileNameWithoutExt.replace(/^\d+-/, "");

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

            // 4. Call Bedrock (using MODEL_ID from environment)
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
                            { text: ocrPrompt },
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
                    modelId: MODEL_ID,
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

            // 5.5. Extract confidence from Bedrock response (if available)
            // @ai-intent: Nova models may provide confidence in metadata, default to null if not available
            const confidence = null; // Nova Lite doesn't provide confidence in current API

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
                processingModel: modelId, // Model configured in Admin Panel
                ...(confidence !== null && { confidence }), // Only include if available
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
                    processingModel: modelId, // Model configured in Admin Panel
                    ...(confidence !== null && { confidence }), // Only include if available
                    ...(isGuestUser(userId) && { ttl: getGuestTTL(), isGuest: true }),
                };
            } else {
                transaction = validationResult.data;
            }

            // 7. Move to processed/ FIRST (before DynamoDB write)
            // @ai-intent: Copy before DB write ensures s3Key is valid when transaction is created
            // This prevents orphaned transactions with non-existent s3Keys
            await s3.send(new CopyObjectCommand({
                Bucket: bucket,
                CopySource: `${bucket}/${key}`,
                Key: processedKey,
            }));

            // 8. Verify copy succeeded before proceeding
            try {
                await s3.send(new HeadObjectCommand({
                    Bucket: bucket,
                    Key: processedKey,
                }));
            } catch (headErr) {
                logger.error(EVENTS.IMAGE_PROCESSING_FAILED, {
                    userId,
                    imageId,
                    reason: "S3_COPY_VERIFICATION_FAILED",
                    processedKey,
                    error: headErr.message,
                });
                continue; // Skip - don't create transaction with invalid s3Key
            }

            // 9. Write to DynamoDB (Pillar Q: Conditional check for idempotency)
            // Now safe to write - s3Key is guaranteed to exist
            try {
                await ddb.send(new PutItemCommand({
                    TableName: TRANSACTIONS_TABLE_NAME,
                    Item: marshall(transaction),
                    ConditionExpression: "attribute_not_exists(transactionId)",
                }));
            } catch (ddbError) {
                if (ddbError.name === "ConditionalCheckFailedException") {
                    logger.info(EVENTS.IMAGE_PROCESSING_CACHED, { transactionId });
                    // Transaction already exists, proceed to cleanup original
                } else {
                    throw ddbError;
                }
            }

            // 10. Delete original from uploads/ (cleanup)
            await s3.send(new DeleteObjectCommand({
                Bucket: bucket,
                Key: key,
            }));

            logger.info(EVENTS.IMAGE_PROCESSING_COMPLETED, { userId, imageId, transactionId, s3Key: processedKey });

        } catch (error) {
            logger.error(EVENTS.IMAGE_PROCESSING_FAILED, { userId, key, error: error.message });
            // We don't throw to avoid S3 retry loops for data errors
        }
    }
}

// Force deploy: 2026-01-10-14:55 (s3Key validation: copy-verify-then-write)
