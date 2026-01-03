import { S3Client, ListObjectsV2Command, GetObjectCommand, CopyObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { marshall } from "@aws-sdk/util-dynamodb";
import { randomUUID } from "crypto";

const s3 = new S3Client({});
const ddb = new DynamoDBClient({});
const bedrock = new BedrockRuntimeClient({});

const BUCKET_NAME = process.env.BUCKET_NAME;
const TRANSACTIONS_TABLE_NAME = process.env.TRANSACTIONS_TABLE_NAME;
const MAX_IMAGES_PER_RUN = parseInt(process.env.MAX_IMAGES_PER_RUN || "100");

// Guest data expires after 60 days of inactivity
const GUEST_TTL_DAYS = 60;

/**
 * Check if userId is a guest (device-* or ephemeral-*)
 */
function isGuestUser(userId) {
  return userId.startsWith("device-") || userId.startsWith("ephemeral-");
}

/**
 * Calculate TTL timestamp for guest users
 * @returns {number} Unix timestamp (seconds) 60 days from now
 */
function getGuestTTL() {
  return Math.floor(Date.now() / 1000) + GUEST_TTL_DAYS * 24 * 60 * 60;
}

/**
 * OCR prompt for receipt analysis
 */
const OCR_PROMPT = `あなたは日本語と英語に対応したレシート解析AIです。
この画像はレシートまたは領収書です。以下の情報を抽出してJSON形式で返してください。

必須フィールド:
- amount: 金額（数値、円単位）
- type: "income" または "expense"
- date: 日付（YYYY-MM-DD形式）
- merchant: 店舗名または取引先名
- category: カテゴリ（以下から選択）
  - sales: 売上
  - purchase: 仕入れ
  - shipping: 送料
  - packaging: 梱包材
  - fee: 手数料
  - other: その他
- description: 取引の説明（簡潔に）

JSON形式で返してください。マークダウンのコードブロックは使わないでください。
例: {"amount": 1500, "type": "expense", "date": "2025-01-15", "merchant": "ヤマト運輸", "category": "shipping", "description": "荷物発送"}`;

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
      // Skip folders and non-image files
      if (obj.Key.endsWith("/")) continue;
      if (!obj.Key.match(/\.(webp|jpg|jpeg|png)$/i)) continue;

      // Extract userId from path: uploads/{userId}/{timestamp}-{filename}
      const pathParts = obj.Key.split("/");
      if (pathParts.length >= 3) {
        images.push({
          key: obj.Key,
          userId: pathParts[1],
          size: obj.Size,
        });
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken && images.length < MAX_IMAGES_PER_RUN);

  return images.slice(0, MAX_IMAGES_PER_RUN);
}

/**
 * Get image from S3 as base64
 */
async function getImageBase64(key) {
  const response = await s3.send(
    new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    })
  );

  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("base64");
}

/**
 * Call Bedrock Nova Lite for OCR
 */
async function callBedrockOCR(imageBase64, mediaType = "image/webp") {
  const payload = {
    messages: [
      {
        role: "user",
        content: [
          {
            image: {
              format: mediaType.split("/")[1] || "webp",
              source: {
                bytes: imageBase64,
              },
            },
          },
          {
            text: OCR_PROMPT,
          },
        ],
      },
    ],
    inferenceConfig: {
      maxTokens: 1024,
      temperature: 0.1,
    },
  };

  const response = await bedrock.send(
    new InvokeModelCommand({
      modelId: "amazon.nova-lite-v1:0",
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload),
    })
  );

  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  return responseBody.output?.message?.content?.[0]?.text || "";
}

/**
 * Parse OCR result to transaction object
 */
function parseOcrResult(ocrText, userId, imageKey) {
  try {
    // Try to extract JSON from the response
    let jsonStr = ocrText.trim();

    // Remove markdown code blocks if present
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    }

    const parsed = JSON.parse(jsonStr);

    // Validate required fields
    if (typeof parsed.amount !== "number") {
      throw new Error("Invalid amount");
    }

    const transactionId = randomUUID();
    const now = new Date().toISOString();

    const transaction = {
      userId,
      transactionId,
      amount: parsed.amount,
      type: parsed.type || (parsed.amount >= 0 ? "income" : "expense"),
      date: parsed.date || now.slice(0, 10),
      merchant: parsed.merchant || "Unknown",
      category: parsed.category || "other",
      description: parsed.description || "",
      imageKey,
      aiProcessed: true,
      confirmedAt: null, // User needs to confirm
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    // Guest users: set TTL for 60-day expiration
    if (isGuestUser(userId)) {
      transaction.ttl = getGuestTTL();
      transaction.isGuest = true;
    }

    return transaction;
  } catch (error) {
    console.error("Failed to parse OCR result:", ocrText, error);
    return null;
  }
}

/**
 * Write transaction to DynamoDB with idempotency
 */
async function writeTransaction(transaction) {
  try {
    await ddb.send(
      new PutItemCommand({
        TableName: TRANSACTIONS_TABLE_NAME,
        Item: marshall(transaction),
        ConditionExpression: "attribute_not_exists(transactionId)", // Pillar Q: Idempotency
      })
    );
    return true;
  } catch (error) {
    if (error.name === "ConditionalCheckFailedException") {
      console.log("Transaction already exists:", transaction.transactionId);
      return true; // Already processed
    }
    throw error;
  }
}

/**
 * Move processed image to processed/ prefix
 */
async function markImageProcessed(key) {
  const newKey = key.replace("uploads/", "processed/");

  // Copy to new location
  await s3.send(
    new CopyObjectCommand({
      Bucket: BUCKET_NAME,
      CopySource: `${BUCKET_NAME}/${key}`,
      Key: newKey,
    })
  );

  // Delete original
  await s3.send(
    new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    })
  );
}

/**
 * Process a single image
 */
async function processImage(image) {
  const { key, userId } = image;
  console.log(`Processing image: ${key}`);

  try {
    // 1. Get image from S3
    const imageBase64 = await getImageBase64(key);

    // 2. Call Bedrock OCR
    const ocrResult = await callBedrockOCR(imageBase64);
    console.log(`OCR result for ${key}:`, ocrResult.substring(0, 200));

    // 3. Parse OCR result
    const transaction = parseOcrResult(ocrResult, userId, key);
    if (!transaction) {
      console.error(`Failed to parse OCR for ${key}`);
      return { success: false, key, error: "PARSE_FAILED" };
    }

    // 4. Write to DynamoDB
    await writeTransaction(transaction);

    // 5. Mark as processed
    await markImageProcessed(key);

    console.log(`Successfully processed: ${key}`);
    return { success: true, key, transactionId: transaction.transactionId };
  } catch (error) {
    console.error(`Error processing ${key}:`, error);
    return { success: false, key, error: error.message };
  }
}

export async function handler(event) {
  console.log("Batch process started:", JSON.stringify(event));

  const startTime = Date.now();
  const results = {
    processed: 0,
    failed: 0,
    errors: [],
  };

  try {
    // 1. List unprocessed images
    const images = await listUnprocessedImages();
    console.log(`Found ${images.length} images to process`);

    if (images.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "No images to process", results }),
      };
    }

    // 2. Process each image
    for (const image of images) {
      const result = await processImage(image);

      if (result.success) {
        results.processed++;
      } else {
        results.failed++;
        results.errors.push({ key: result.key, error: result.error });
      }

      // Safety: Stop if taking too long (Lambda timeout protection)
      if (Date.now() - startTime > 4 * 60 * 1000) {
        console.log("Approaching timeout, stopping early");
        break;
      }
    }

    const duration = (Date.now() - startTime) / 1000;
    console.log(`Batch process completed in ${duration}s:`, results);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Batch process completed",
        duration: `${duration}s`,
        results,
      }),
    };
  } catch (error) {
    console.error("Batch process error:", error);
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
