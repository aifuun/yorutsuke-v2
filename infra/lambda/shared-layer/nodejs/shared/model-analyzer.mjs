import { TextractClient, AnalyzeExpenseCommand } from "@aws-sdk/client-textract";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { logger } from "./logger.mjs";
import { ModelResultSchema } from "./schemas.mjs";

const textractClient = new TextractClient({});
const bedrockClient = new BedrockRuntimeClient({});

/**
 * Multi-Model Receipt Analyzer
 * Orchestrates parallel analysis via Textract, Nova Mini/Pro, and Claude Sonnet
 * Normalizes results to unified ModelResultSchema for comparison
 *
 * @ai-intent: Allow partial failures - if one model fails, others still complete
 * Performance-critical for same-transaction comparison
 */
export class MultiModelAnalyzer {
  /**
   * Analyze receipt with all 4 models in parallel
   * @param {Object} params
   * @param {string} params.imageBase64 - Base64-encoded receipt image
   * @param {string} params.s3Key - S3 object key for Textract access
   * @param {string} params.bucket - S3 bucket name
   * @param {string} params.traceId - Trace ID for logging
   * @param {string} params.imageId - Image ID for logging
   * @returns {Promise<Object>} Comparison result with all 4 models + errors
   */
  async analyzeReceipt({ imageBase64, s3Key, bucket, traceId, imageId }) {
    logger.info("MODEL_COMPARISON_STARTED", { traceId, imageId });

    // Run all 4 models in parallel with graceful error handling
    const results = await Promise.allSettled([
      this.analyzeTextract(s3Key, bucket, traceId),
      this.analyzeNovaMini(imageBase64, traceId),
      this.analyzeNovaProBedrock(imageBase64, traceId),
      this.analyzeClaudeSonnetBedrock(imageBase64, traceId),
    ]);

    const modelNames = ["textract", "nova_mini", "nova_pro", "claude_sonnet"];
    const comparison = {};
    const errors = [];

    results.forEach((result, index) => {
      const modelName = modelNames[index];
      if (result.status === "fulfilled") {
        comparison[modelName] = result.value;
        logger.debug("MODEL_COMPLETED", { traceId, model: modelName });
      } else {
        errors.push({
          model: modelName,
          error: result.reason?.message || String(result.reason),
          timestamp: new Date().toISOString(),
        });
        logger.warn("MODEL_FAILED", {
          traceId,
          model: modelName,
          error: result.reason?.message,
        });
      }
    });

    const comparisonResult = {
      textract: comparison.textract || null,
      nova_mini: comparison.nova_mini || null,
      nova_pro: comparison.nova_pro || null,
      claude_sonnet: comparison.claude_sonnet || null,
      comparisonStatus: errors.length === 4 ? "failed" : "completed",
      comparisonErrors: errors.length > 0 ? errors : undefined,
      comparisonTimestamp: new Date().toISOString(),
    };

    logger.info("MODEL_COMPARISON_COMPLETED", {
      traceId,
      imageId,
      status: comparisonResult.comparisonStatus,
      successCount: Object.values(comparison).filter((v) => v !== null).length,
      failureCount: errors.length,
    });

    return comparisonResult;
  }

  /**
   * Analyze via AWS Textract AnalyzeExpense
   * Requires S3 input (direct file reference)
   * Locale: ja-JP for Japanese receipts
   */
  async analyzeTextract(s3Key, bucket, traceId) {
    try {
      const response = await textractClient.send(
        new AnalyzeExpenseCommand({
          Document: {
            S3Object: {
              Bucket: bucket,
              Name: s3Key,
            },
          },
        })
      );

      return this.normalizeTextractResult(response);
    } catch (error) {
      logger.error("TEXTRACT_ERROR", {
        traceId,
        error: error.message,
        code: error.Code,
      });
      throw new Error(`Textract analysis failed: ${error.message}`);
    }
  }

  /**
   * Analyze via Amazon Nova Mini (via Bedrock)
   * Fast, cost-effective, good for initial screening
   * @ai-intent: Keep prompt minimal to match Nova Mini's token limits
   */
  async analyzeNovaMini(imageBase64, traceId) {
    try {
      const prompt = `あなたは日本語のレシート解析AIです。
この画像から以下のJSON形式で抽出してください:
{
  "vendor": "店舗名",
  "totalAmount": 数値,
  "taxAmount": 数値,
  "taxRate": 数値,
  "subtotal": 数値,
  "confidence": 0-100
}`;

      const payload = {
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/webp",
                  data: imageBase64,
                },
              },
              {
                type: "text",
                text: prompt,
              },
            ],
          },
        ],
        max_tokens: 512,
        temperature: 0.1,
      };

      const response = await bedrockClient.send(
        new InvokeModelCommand({
          modelId: "us.amazon.nova-lite-v1:0",  // Cross-region inference
          contentType: "application/json",
          accept: "application/json",
          body: JSON.stringify(payload),
        })
      );

      const responseBody = JSON.parse(
        new TextDecoder().decode(response.body)
      );
      const text =
        responseBody.output?.message?.content?.[0]?.text || "{}";

      return this.parseAndNormalizeJson(text);
    } catch (error) {
      logger.error("NOVA_MINI_ERROR", { traceId, error: error.message });
      throw new Error(`Nova Mini analysis failed: ${error.message}`);
    }
  }

  /**
   * Analyze via Amazon Nova Pro (via Bedrock)
   * More capable, detailed structure extraction
   * Includes line items for detailed comparison
   * @ai-intent: Detailed prompt with line items for comprehensive extraction
   */
  async analyzeNovaProBedrock(imageBase64, traceId) {
    try {
      const prompt = `あなたは日本語のレシート解析AIです。この画像から以下のJSON形式で詳細に抽出してください：

{
  "vendor": "店舗名/商号",
  "lineItems": [
    {
      "description": "商品名/サービス名",
      "quantity": 数量,
      "unitPrice": 単価,
      "totalPrice": 金額
    }
  ],
  "subtotal": 小計,
  "taxAmount": 消費税,
  "taxRate": 税率（8または10など）,
  "totalAmount": 合計金額,
  "confidence": 0-100の信頼度スコア
}

マークダウンのコードブロックは使わないでください。JSONのみを返してください。`;

      const payload = {
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/webp",
                  data: imageBase64,
                },
              },
              {
                type: "text",
                text: prompt,
              },
            ],
          },
        ],
        max_tokens: 1024,
        temperature: 0.1,
      };

      const response = await bedrockClient.send(
        new InvokeModelCommand({
          modelId: "us.amazon.nova-pro-v1:0",  // Cross-region inference
          contentType: "application/json",
          accept: "application/json",
          body: JSON.stringify(payload),
        })
      );

      const responseBody = JSON.parse(
        new TextDecoder().decode(response.body)
      );
      const text =
        responseBody.output?.message?.content?.[0]?.text || "{}";

      return this.parseAndNormalizeJson(text);
    } catch (error) {
      logger.error("NOVA_PRO_ERROR", { traceId, error: error.message });
      throw new Error(`Nova Pro analysis failed: ${error.message}`);
    }
  }

  /**
   * Analyze via Claude 3.5 Sonnet (via Bedrock)
   * Most capable, sophisticated understanding
   * Best for edge cases and complex receipts
   * @ai-intent: Explicitly request JSON output without markdown
   */
  async analyzeClaudeSonnetBedrock(imageBase64, traceId) {
    try {
      const systemPrompt =
        "あなたは日本語のレシート解析AIです。必ずJSON形式のみで、マークダウンコードブロックなしで応答してください。";

      const userPrompt = `この画像から以下のJSON形式で詳細に抽出してください：

{
  "vendor": "店舗名/商号",
  "lineItems": [
    {
      "description": "商品名/サービス名",
      "quantity": 数量,
      "unitPrice": 単価,
      "totalPrice": 金額
    }
  ],
  "subtotal": 小計,
  "taxAmount": 消費税,
  "taxRate": 税率,
  "totalAmount": 合計金額,
  "confidence": 0-100
}

JSONのみを返してください。`;

      const payload = {
        anthropic_version: "bedrock-2023-06-01",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/webp",
                  data: imageBase64,
                },
              },
              {
                type: "text",
                text: userPrompt,
              },
            ],
          },
        ],
      };

      const response = await bedrockClient.send(
        new InvokeModelCommand({
          modelId: "us.anthropic.claude-3-5-sonnet-20241022-v2:0",  // Cross-region inference
          contentType: "application/json",
          accept: "application/json",
          body: JSON.stringify(payload),
        })
      );

      const responseBody = JSON.parse(
        new TextDecoder().decode(response.body)
      );
      const text =
        responseBody.content?.[0]?.text || "{}";

      return this.parseAndNormalizeJson(text);
    } catch (error) {
      logger.error("CLAUDE_SONNET_ERROR", {
        traceId,
        error: error.message,
      });
      throw new Error(`Claude Sonnet analysis failed: ${error.message}`);
    }
  }

  /**
   * Normalize Textract response to ModelResultSchema
   * Textract returns ExpenseDocument with Blocks structure
   */
  normalizeTextractResult(response) {
    try {
      if (!response.ExpenseDocuments?.[0]) {
        return ModelResultSchema.parse({});
      }

      const expenseDoc = response.ExpenseDocuments[0];
      const summaryFields = expenseDoc.SummaryFields || [];

      // Extract key fields from Textract response
      const result = {
        vendor: this.extractTextractField(summaryFields, "VENDOR_NAME"),
        subtotal: this.extractTextractAmount(summaryFields, "SUBTOTAL"),
        taxAmount: this.extractTextractAmount(summaryFields, "TAX"),
        totalAmount: this.extractTextractAmount(summaryFields, "TOTAL"),
        confidence: 85, // Textract confidence varies, approximate
        lineItems: this.extractTextractLineItems(
          expenseDoc.LineItemGroups
        ),
      };

      return ModelResultSchema.parse(result);
    } catch (error) {
      logger.warn("TEXTRACT_NORMALIZATION_ERROR", {
        error: error.message,
      });
      return ModelResultSchema.parse({});
    }
  }

  /**
   * Extract field value from Textract summary fields
   */
  extractTextractField(summaryFields, fieldType) {
    const field = summaryFields.find((f) => f.Type?.Text === fieldType);
    return field?.ValueDetection?.Text || undefined;
  }

  /**
   * Extract numeric amount from Textract summary fields
   */
  extractTextractAmount(summaryFields, fieldType) {
    const field = summaryFields.find((f) => f.Type?.Text === fieldType);
    if (!field?.ValueDetection?.Text) return undefined;

    const match = field.ValueDetection.Text.match(/[\d,]+(?:\.\d{1,2})?/);
    return match
      ? parseFloat(match[0].replace(/,/g, ""))
      : undefined;
  }

  /**
   * Extract line items from Textract LineItemGroups
   */
  extractTextractLineItems(lineItemGroups) {
    if (!lineItemGroups?.length) return undefined;

    return lineItemGroups
      .slice(0, 50) // Limit to 50 items
      .map((group) => {
        const fields = group.LineItems?.[0]?.LineItemExpenseFields || [];

        return {
          description: this.extractTextractField(fields, "ITEM_DESCRIPTION"),
          quantity: parseFloat(
            this.extractTextractField(fields, "ITEM_QUANTITY") || "1"
          ),
          unitPrice: this.extractTextractAmount(fields, "ITEM_PRICE"),
          totalPrice: this.extractTextractAmount(fields, "ITEM_AMOUNT"),
        };
      })
      .filter(
        (item) =>
          item.description ||
          item.unitPrice ||
          item.totalPrice
      );
  }

  /**
   * Parse JSON response and normalize to ModelResultSchema
   * Handles markdown code blocks and malformed JSON gracefully
   */
  parseAndNormalizeJson(jsonText) {
    try {
      let cleaned = jsonText.trim();

      // Remove markdown code blocks
      if (cleaned.startsWith("```")) {
        cleaned = cleaned
          .replace(/```json?\n?/g, "")
          .replace(/```/g, "")
          .trim();
      }

      const parsed = JSON.parse(cleaned);

      // Validate against schema
      return ModelResultSchema.parse(parsed);
    } catch (error) {
      logger.warn("JSON_PARSE_ERROR", {
        error: error.message,
        rawLength: jsonText.length,
      });

      // Return empty but valid schema on parse failure
      return ModelResultSchema.parse({});
    }
  }
}
