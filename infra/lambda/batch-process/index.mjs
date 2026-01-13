import { S3Client, ListObjectsV2Command, GetObjectCommand, CopyObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { marshall } from "@aws-sdk/util-dynamodb";
import { logger, EVENTS, setContext } from "/opt/nodejs/shared/logger.mjs";
import { OcrResultSchema, TransactionSchema } from "/opt/nodejs/shared/schemas.mjs";

const s3 = new S3Client({});
const ddb = new DynamoDBClient({});
const bedrock = new BedrockRuntimeClient({});

const BUCKET_NAME = process.env.BUCKET_NAME;
const TRANSACTIONS_TABLE_NAME = process.env.TRANSACTIONS_TABLE_NAME;
const MAX_IMAGES_PER_RUN = parseInt(process.env.MAX_IMAGES_PER_RUN || "100");

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
 * Build OCR prompt with optional merchant list (batch processor - business focused categories)
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
- category: カテゴリ（以下から选择）
  - sale: 売上
  - purchase: 仕入れ
  - shipping: 送料
  - packaging: 梱包材
  - fee: 手数料
  - other: その他
- description: 取引の説明（简洁に）${merchantListText}

JSON形式で返してください。マークダウンのコードブロックは使わないでください。
例: {"amount": 1500, "type": "expense", "date": "2025-01-15", "merchant": "ヤマト運輸", "category": "shipping", "description": "荷物発送"}`;
}

/**
 * List unprocessed images from S3
 */
async function listUnprocessedImages() {
  const images = [];
  let continuationToken;

  do {
    const response = await s3.send(
      new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: "uploads/",
        MaxKeys: MAX_IMAGES_PER_RUN,
        ContinuationToken: continuationToken,
      })
    );

    for (const obj of response.Contents || []) {
      if (obj.Key.endsWith("/")) continue;
      if (!obj.Key.match(/\.(webp|jpg|jpeg|png)$/i)) continue;

      const pathParts = obj.Key.split("/");
      if (pathParts.length >= 3) {
        images.push({
          key: obj.Key,
          userId: pathParts[1],
          fileName: pathParts[2],
          size: obj.Size,
        });
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken && images.length < MAX_IMAGES_PER_RUN);

  return images.slice(0, MAX_IMAGES_PER_RUN);
}

/**
 * Process a single image
 */
async function processImage(image, ocrPrompt) {
  const { key, userId, fileName } = image;
  const imageId = fileName.replace(/\.[^/.]+$/, "");
  const transactionId = `tx-${imageId}`; // Pillar Q: Stable ID

  logger.info(EVENTS.IMAGE_PROCESSING_STARTED, { key, userId });

  try {
    // 1. Get image from S3
    const s3Response = await s3.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
    const chunks = [];
    for await (const chunk of s3Response.Body) {
      chunks.push(chunk);
    }
    const imageBase64 = Buffer.concat(chunks).toString("base64");

    // 2. Call Bedrock OCR
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
        modelId: "amazon.nova-lite-v1:0",
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify(payload),
      })
    );

    const responseBody = JSON.parse(new TextDecoder().decode(bedrockResponse.body));
    const ocrText = responseBody.output?.message?.content?.[0]?.text || "";

    // 3. Pillar B: Airlock - Parse & Validate
    let jsonStr = ocrText.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    }

    let parsed;
    try {
      parsed = OcrResultSchema.parse(JSON.parse(jsonStr));
    } catch (zodError) {
      logger.error(EVENTS.AIRLOCK_BREACH, { userId, imageId, error: zodError.message, raw: jsonStr });
      return { success: false, key, error: "AIRLOCK_BREACH" };
    }

    // 4. Create Transaction Object
    const now = new Date().toISOString();
    const transactionData = {
      userId,
      transactionId,
      imageId,
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

    const transaction = TransactionSchema.parse(transactionData);

    // 5. Write to DynamoDB (Pillar Q)
    try {
      await ddb.send(new PutItemCommand({
        TableName: TRANSACTIONS_TABLE_NAME,
        Item: marshall(transaction),
        ConditionExpression: "attribute_not_exists(transactionId)",
      }));
    } catch (ddbError) {
      if (ddbError.name === "ConditionalCheckFailedException") {
        logger.info(EVENTS.IMAGE_PROCESSING_CACHED, { transactionId });
      } else {
        throw ddbError;
      }
    }

    // 6. Move processed image
    const newKey = key.replace("uploads/", "processed/");
    await s3.send(new CopyObjectCommand({
      Bucket: BUCKET_NAME,
      CopySource: `${BUCKET_NAME}/${key}`,
      Key: newKey,
    }));
    await s3.send(new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    }));

    logger.info(EVENTS.IMAGE_PROCESSING_COMPLETED, { key, transactionId });
    return { success: true, key, transactionId };
  } catch (error) {
    logger.error(EVENTS.IMAGE_PROCESSING_FAILED, { key, error: error.message });
    return { success: false, key, error: error.message };
  }
}

export async function handler(event) {
  const traceId = `batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  setContext({ traceId });

  logger.info(EVENTS.BATCH_STARTED, { event: JSON.stringify(event) });

  // Load merchant list once at start (cached for subsequent invocations)
  const merchantList = await loadMerchantList();
  const ocrPrompt = buildOCRPrompt(merchantList);

  const startTime = Date.now();
  const results = {
    processed: 0,
    failed: 0,
    errors: [],
  };

  try {
    const images = await listUnprocessedImages();
    logger.info(EVENTS.BATCH_STARTED, { imageCount: images.length });

    if (images.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "No images to process", results }),
      };
    }

    for (const image of images) {
      const result = await processImage(image, ocrPrompt);

      if (result.success) {
        results.processed++;
      } else {
        results.failed++;
        results.errors.push({ key: result.key, error: result.error });
      }

      if (Date.now() - startTime > 4 * 60 * 1000) {
        logger.warn(EVENTS.BATCH_COMPLETED, { reason: "timeout_approaching" });
        break;
      }
    }

    const duration = (Date.now() - startTime) / 1000;
    logger.info(EVENTS.BATCH_COMPLETED, { duration, processed: results.processed, failed: results.failed });

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Batch process completed",
        duration: `${duration}s`,
        results,
      }),
    };
  } catch (error) {
    logger.error(EVENTS.BATCH_FAILED, { error: error.message, stack: error.stack, results });
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "BATCH_FAILED",
        message: error.message,
        results,
      }),
    };
  }
}
